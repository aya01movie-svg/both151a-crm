import { createClient } from "@/lib/supabase/server";
import type { Bottle } from "@/types/database";
import { getExpiryTier } from "@/lib/bottle-expiry";

export type BottleWithCustomer = Bottle & {
  customer_display_name: string;
  /** ボトル所有者が代表者だった来店の同伴者名リスト（最大5名） */
  companion_names: string[];
};

const PAGE_SIZE = 50;

export type BottleStatusFilter =
  | "kept"
  | "expiring30"
  | "expired"
  | "finished"
  | "returned"
  | "disposed";

/**
 * ボトル一覧。
 *
 * RC6修正:
 * ・顧客名検索を search_customers RPC 経由に変更 →
 *   同伴者でヒットした顧客の代表者ボトルもボトルタブに表示できる
 * ・各ボトルに「代表者の来店に同伴した人」のリストを付与 →
 *   ボトルタブで「この来店のメンバー」を確認できる
 */
export async function listBottles(params: {
  search?: string;
  page?: number;
  statuses?: BottleStatusFilter[];
}): Promise<{ bottles: BottleWithCustomer[]; hasMore: boolean }> {
  const { search, page = 0, statuses } = params;
  const supabase = await createClient();

  // ──────────────────────────────────────────────
  // 顧客ID解決: search_customers RPC を使い、
  // 同伴者で検索してもその代表者のボトルが出るようにする
  // ──────────────────────────────────────────────
  let customerIds: string[] | null = null;
  if (search && search.trim()) {
    // 1. search_customers で「この検索語に関係する顧客ID」を取得
    const { data: matchedCustomers } = await supabase.rpc("search_customers", {
      p_query: search.trim(),
    });
    const directIds = ((matchedCustomers ?? []) as { customer_id: string }[])
      .map((r) => r.customer_id);

    // 2. マッチした顧客が「同伴者」だった場合、その来店の代表者のボトルも表示する
    //    → visit_members で companion のIDから primary_customer_id を取得
    let representativeIds: string[] = [];
    if (directIds.length > 0) {
      const { data: memberRows } = await supabase
        .from("visit_members")
        .select("visit_id")
        .in("customer_id", directIds)
        .eq("member_type", "companion");

      const visitIds = [...new Set((memberRows ?? []).map((m: { visit_id: string }) => m.visit_id))];
      if (visitIds.length > 0) {
        const { data: visitRows } = await supabase
          .from("visits")
          .select("primary_customer_id")
          .in("id", visitIds)
          .eq("invalidated", false);
        representativeIds = [...new Set(
          (visitRows ?? []).map((v: { primary_customer_id: string }) => v.primary_customer_id)
        )];
      }
    }

    customerIds = [...new Set([...directIds, ...representativeIds])];
  }

  // ──────────────────────────────────────────────
  // ボトル取得
  // ──────────────────────────────────────────────
  const hasStatusFilter = !!statuses && statuses.length > 0;
  const directStatuses = new Set(
    (statuses ?? []).filter((s) => ["finished", "returned", "disposed"].includes(s))
  );
  const includeKept = (statuses ?? []).some((s) => ["kept", "expiring30", "expired"].includes(s));

  let query = supabase
    .from("bottles")
    .select("*, customers(display_name)")
    .order("status", { ascending: true })
    .order("expiry_date", { ascending: true });

  if (hasStatusFilter) {
    const dbStatuses = [...directStatuses, ...(includeKept ? (["kept"] as const) : [])] as (
      | "finished" | "returned" | "disposed" | "kept"
    )[];
    query = query.in("status", dbStatuses.length > 0 ? dbStatuses : ["kept", "finished", "returned", "disposed"]);
  } else {
    query = query.range(0, 499);
  }

  if (search && search.trim()) {
    const orParts: string[] = [];
    // ボトル名・種類でも直接検索
    orParts.push(`bottle_name.ilike.%${search.trim()}%`);
    orParts.push(`bottle_type.ilike.%${search.trim()}%`);
    // 顧客IDでの絞り込み（代表者 + 同伴者から派生した代表者ID）
    if (customerIds && customerIds.length > 0) {
      orParts.push(`customer_id.in.(${customerIds.join(",")})`);
    }
    query = query.or(orParts.join(","));
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as unknown as (Bottle & {
    customers: { display_name: string } | null;
  })[];

  // 状態フィルタリング
  let filtered = rows;
  if (hasStatusFilter) {
    const wantsPlainKept   = statuses!.includes("kept");
    const wantsExpiring30  = statuses!.includes("expiring30");
    const wantsExpired     = statuses!.includes("expired");
    filtered = rows.filter((b) => {
      if (b.status !== "kept") return directStatuses.has(b.status as BottleStatusFilter);
      if (!wantsPlainKept && !wantsExpiring30 && !wantsExpired) return false;
      if (wantsPlainKept) return true;
      const tier = getExpiryTier(b.expiry_date);
      if (wantsExpired && tier === "expired") return true;
      if (wantsExpiring30 && (tier === "within7" || tier === "within14" || tier === "within30")) return true;
      return false;
    });
  }

  const hasMore = filtered.length > (page + 1) * PAGE_SIZE;
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // ──────────────────────────────────────────────
  // 各ボトルの所有者（代表者）の来店に参加した同伴者名を取得
  // → ボトルタブで「このボトルの来店メンバー」を確認できる
  // ──────────────────────────────────────────────
  const bottleCustomerIds = [...new Set(pageRows.map((b) => b.customer_id))];
  const companionNamesByCustomer = new Map<string, string[]>();

  if (bottleCustomerIds.length > 0) {
    // 代表者として来店した visit_id を取得
    const { data: repVisits } = await supabase
      .from("visits")
      .select("id, primary_customer_id")
      .in("primary_customer_id", bottleCustomerIds)
      .eq("invalidated", false)
      .order("visited_at", { ascending: false })
      .limit(200);

    const repVisitIds = (repVisits ?? []).map((v: { id: string }) => v.id);
    const visitToPrimary = new Map(
      (repVisits ?? []).map((v: { id: string; primary_customer_id: string }) => [v.id, v.primary_customer_id])
    );

    if (repVisitIds.length > 0) {
      // RC7修正: customers(display_name) のネストembed は環境によって不安定なため
      // 2段クエリに分解する（RC8で確認済みの安定パターン）
      const { data: memberRows } = await supabase
        .from("visit_members")
        .select("visit_id, customer_id")
        .in("visit_id", repVisitIds)
        .eq("member_type", "companion");

      const companionCustomerIds = [...new Set(
        (memberRows ?? []).map((m: { customer_id: string }) => m.customer_id)
      )];

      if (companionCustomerIds.length > 0) {
        const { data: companionCustomers } = await supabase
          .from("customers")
          .select("id, display_name")
          .in("id", companionCustomerIds);

        const nameById = new Map(
          (companionCustomers ?? []).map((c: { id: string; display_name: string }) => [c.id, c.display_name])
        );

        for (const row of (memberRows ?? []) as { visit_id: string; customer_id: string }[]) {
          const primaryId = visitToPrimary.get(row.visit_id);
          const name = nameById.get(row.customer_id);
          if (!primaryId || !name) continue;
          const list = companionNamesByCustomer.get(primaryId) ?? [];
          if (!list.includes(name)) list.push(name);
          companionNamesByCustomer.set(primaryId, list);
        }
      }
    }
  }

  return {
    bottles: pageRows.map((b) => ({
      ...b,
      customer_display_name: b.customers?.display_name ?? "",
      companion_names: (companionNamesByCustomer.get(b.customer_id) ?? []).slice(0, 5),
    })),
    hasMore,
  };
}
