import { createClient } from "@/lib/supabase/server";
import type { Bottle } from "@/types/database";
import { getExpiryTier } from "@/lib/bottle-expiry";

export type BottleWithCustomer = Bottle & { customer_display_name: string };

const PAGE_SIZE = 50;

export type BottleStatusFilter =
  | "kept"
  | "expiring30"
  | "expired"
  | "finished"
  | "returned"
  | "disposed";

/**
 * ボトル一覧（第11章・第12章）。
 * 検索：顧客名・ボトル名・種類・期限・状態。
 * RC5: チェック式の状態絞り込み（預かり中/期限30日以内/期限切れ/飲み切り/返却/廃棄）に対応。
 */
export async function listBottles(params: {
  search?: string;
  page?: number;
  statuses?: BottleStatusFilter[];
}): Promise<{ bottles: BottleWithCustomer[]; hasMore: boolean }> {
  const { search, page = 0, statuses } = params;
  const supabase = await createClient();

  let customerIds: string[] | null = null;
  if (search && search.trim()) {
    const { data } = await supabase
      .from("customers")
      .select("id")
      .ilike("display_name", `%${search.trim()}%`);
    customerIds = (data ?? []).map((c) => c.id);
  }

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
      | "finished"
      | "returned"
      | "disposed"
      | "kept"
    )[];
    query = query.in("status", dbStatuses.length > 0 ? dbStatuses : ["kept", "finished", "returned", "disposed"]);
  } else {
    query = query.range(0, 499); // フィルタなし時も上限を設ける
  }

  if (search && search.trim()) {
    const orParts = [
      `bottle_name.ilike.%${search.trim()}%`,
      `bottle_type.ilike.%${search.trim()}%`,
    ];
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

  let filtered = rows;
  if (hasStatusFilter) {
    const wantsPlainKept = statuses!.includes("kept");
    const wantsExpiring30 = statuses!.includes("expiring30");
    const wantsExpired = statuses!.includes("expired");
    filtered = rows.filter((b) => {
      if (b.status !== "kept") return directStatuses.has(b.status as BottleStatusFilter);
      if (!wantsPlainKept && !wantsExpiring30 && !wantsExpired) return false;
      if (wantsPlainKept) return true;
      const tier = getExpiryTier(b.expiry_date);
      if (wantsExpired && tier === "expired") return true;
      if (wantsExpiring30 && (tier === "within7" || tier === "within14" || tier === "within30")) {
        return true;
      }
      return false;
    });
  }

  const hasMore = filtered.length > (page + 1) * PAGE_SIZE;
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return {
    bottles: pageRows.map((b) => ({
      ...b,
      customer_display_name: b.customers?.display_name ?? "",
    })),
    hasMore,
  };
}
