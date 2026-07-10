import { createClient } from "@/lib/supabase/server";
import type {
  Customer,
  CustomerWithMonthStats,
  Tag,
  Visit,
  Bottle,
  Champagne,
  Note,
} from "@/types/database";

const PAGE_SIZE = 50;

type ListCustomersParams = {
  search?: string;
  favoriteOnly?: boolean;
  page?: number;
};

type ListCustomersResult = {
  customers: CustomerWithMonthStats[];
  page: number;
  pageSize: number;
  hasMore: boolean;
};

/**
 * 顧客一覧の取得（第26章）。
 * 500件規模でも快適に動作するよう、
 *  - 検索は search_customers() SQL関数（trigramインデックス使用）で顧客IDに絞り込み
 *  - 一覧本体は limit/offset によるページング
 *  - 今月集計・タグは「そのページに表示する分だけ」追加取得
 * という設計にしている（全件に対してJOINしない）。
 */
export async function listCustomers(
  params: ListCustomersParams = {}
): Promise<ListCustomersResult> {
  const { search, favoriteOnly, page = 0 } = params;
  const supabase = await createClient();

  let matchedIds: string[] | null = null;

  if (search && search.trim().length > 0) {
    const { data, error } = await supabase.rpc("search_customers", {
      p_query: search.trim(),
    });
    if (error) throw error;
    matchedIds = (data ?? []).map((row: { customer_id: string }) => row.customer_id);

    if (matchedIds.length === 0) {
      return { customers: [], page, pageSize: PAGE_SIZE, hasMore: false };
    }
  }

  let query = supabase
    .from("customers")
    .select("*")
    .eq("hidden", false)
    // RC5修正: last_visit_at が同値（NULL含む）の場合、再取得のたびに順序が
    // ばらつき「お気に入りを切り替えたら消えたように見える」原因になっていた。
    // idを第2ソートキーにして常に同じ順序を返すようにする。
    .order("last_visit_at", { ascending: false, nullsFirst: false })
    .order("id", { ascending: true })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE); // 1件多く取得してhasMore判定に使う

  if (matchedIds) {
    query = query.in("id", matchedIds);
  }
  if (favoriteOnly) {
    query = query.eq("favorite", true);
  }

  const { data: rows, error } = await query;
  if (error) throw error;

  const hasMore = (rows?.length ?? 0) > PAGE_SIZE;
  const pageRows = (rows ?? []).slice(0, PAGE_SIZE) as Customer[];
  const ids = pageRows.map((c) => c.id);

  const [monthStatsRes, tagsRes] = await Promise.all([
    ids.length
      ? supabase.from("customer_month_stats").select("*").in("customer_id", ids)
      : Promise.resolve({ data: [], error: null }),
    ids.length
      ? supabase
          .from("customer_tags")
          .select("customer_id, tags(*)")
          .in("customer_id", ids)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (monthStatsRes.error) throw monthStatsRes.error;
  if (tagsRes.error) throw tagsRes.error;

  const monthStatsByCustomer = new Map(
    (monthStatsRes.data ?? []).map((row) => [row.customer_id, row])
  );

  const tagsByCustomer = new Map<string, Tag[]>();
  for (const row of (tagsRes.data ?? []) as unknown as {
    customer_id: string;
    tags: Tag;
  }[]) {
    const list = tagsByCustomer.get(row.customer_id) ?? [];
    if (row.tags) list.push(row.tags);
    tagsByCustomer.set(row.customer_id, list);
  }

  const customers: CustomerWithMonthStats[] = pageRows.map((c) => {
    const month = monthStatsByCustomer.get(c.id);
    return {
      ...c,
      month_visit_count: month?.month_visit_count ?? 0,
      month_amount: month?.month_amount ?? 0,
      month_tip: month?.month_tip ?? 0,
      tags: tagsByCustomer.get(c.id) ?? [],
    };
  });

  return { customers, page, pageSize: PAGE_SIZE, hasMore };
}

export type NoteWithAuthor = Note & { authorName: string | null };

export type VisitHistoryEntry = Visit & {
  role: "primary" | "companion";
  companionOfName: string | null;
  companionNames: string[];
};

export type AssociatedBottle = Bottle & { ownerName: string };

export type CustomerDetail = {
  customer: CustomerWithMonthStats;
  visits: VisitHistoryEntry[];
  bottles: Bottle[];
  associatedBottles: AssociatedBottle[];
  champagnes: Champagne[];
  notes: NoteWithAuthor[];
  cautionRegisteredByName: string | null;
};

/** 顧客詳細（第6章・第11章・第23章）に必要な情報を1回で取得する。 */
export async function getCustomerDetail(
  customerId: string
): Promise<CustomerDetail | null> {
  const supabase = await createClient();

  const [
    customerRes,
    monthRes,
    tagsRes,
    primaryVisitsRes,
    companionVisitsRes,
    bottlesRes,
    champagnesRes,
    notesRes,
  ] = await Promise.all([
    supabase.from("customers").select("*").eq("id", customerId).single(),
    supabase
      .from("customer_month_stats")
      .select("*")
      .eq("customer_id", customerId)
      .maybeSingle(),
    supabase
      .from("customer_tags")
      .select("tags(*)")
      .eq("customer_id", customerId),
    supabase
      .from("visits")
      .select("*")
      .eq("primary_customer_id", customerId)
      .eq("invalidated", false)
      .order("visited_at", { ascending: false })
      .limit(20),
    // RC5: 同伴者としての来店履歴も表示する（第6章レビュー指摘3）
    // RC8修正: visit_members→visits→customers のネストしたembedクエリは
    // 環境によって不安定なため、シンプルな2段クエリに分解する。
    supabase
      .from("visit_members")
      .select("visit_id")
      .eq("customer_id", customerId)
      .eq("member_type", "companion")
      .limit(20),
    supabase
      .from("bottles")
      .select("*")
      .eq("customer_id", customerId)
      .order("status", { ascending: true })
      .order("expiry_date", { ascending: true }),
    supabase
      .from("champagnes")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false }),
    supabase
      .from("notes")
      .select("*, profiles:created_by(display_name)")
      .eq("customer_id", customerId)
      .eq("invalidated", false)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  if (customerRes.error || !customerRes.data) return null;

  const tags = ((tagsRes.data ?? []) as unknown as { tags: Tag }[])
    .map((r) => r.tags)
    .filter(Boolean);

  const customerRow = customerRes.data as Customer;

  let cautionRegisteredByName: string | null = null;
  if (customerRow.caution_registered_by) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", customerRow.caution_registered_by)
      .maybeSingle();
    cautionRegisteredByName = profile?.display_name ?? null;
  }

  const customer: CustomerWithMonthStats = {
    ...customerRow,
    month_visit_count: monthRes.data?.month_visit_count ?? 0,
    month_amount: monthRes.data?.month_amount ?? 0,
    month_tip: monthRes.data?.month_tip ?? 0,
    tags,
  };

  const primaryVisitRows = (primaryVisitsRes.data ?? []) as Visit[];
  const primaryVisitIds = primaryVisitRows.map((v) => v.id);

  // 2段クエリ（ネストembedは不安定なため同じ修正パターンを適用）
  const companionNamesByVisit = new Map<string, string[]>();
  if (primaryVisitIds.length > 0) {
    const { data: memberRows2 } = await supabase
      .from("visit_members")
      .select("visit_id, customer_id")
      .in("visit_id", primaryVisitIds)
      .eq("member_type", "companion");

    const cIds = [...new Set((memberRows2 ?? []).map((m: { customer_id: string }) => m.customer_id))];
    if (cIds.length > 0) {
      const { data: cCustomers } = await supabase
        .from("customers")
        .select("id, display_name")
        .in("id", cIds);
      const cNameById = new Map(
        (cCustomers ?? []).map((c: { id: string; display_name: string }) => [c.id, c.display_name])
      );
      for (const row of (memberRows2 ?? []) as { visit_id: string; customer_id: string }[]) {
        const name = cNameById.get(row.customer_id);
        if (!name) continue;
        const list = companionNamesByVisit.get(row.visit_id) ?? [];
        list.push(name);
        companionNamesByVisit.set(row.visit_id, list);
      }
    }
  }

  const primaryVisits: VisitHistoryEntry[] = primaryVisitRows.map((v) => ({
    ...v,
    role: "primary" as const,
    companionOfName: null,
    companionNames: companionNamesByVisit.get(v.id) ?? [],
  }));

  const companionVisitIds = ((companionVisitsRes.data ?? []) as { visit_id: string }[]).map(
    (m) => m.visit_id
  );

  let companionVisits: VisitHistoryEntry[] = [];
  if (companionVisitIds.length > 0) {
    const { data: companionVisitRows } = await supabase
      .from("visits")
      .select("*")
      .in("id", companionVisitIds)
      .eq("invalidated", false);

    const rows = (companionVisitRows ?? []) as Visit[];
    const primaryIds = [...new Set(rows.map((v) => v.primary_customer_id))];
    let primaryNameById = new Map<string, string>();
    if (primaryIds.length > 0) {
      const { data: primaryCustomers } = await supabase
        .from("customers")
        .select("id, display_name")
        .in("id", primaryIds);
      primaryNameById = new Map((primaryCustomers ?? []).map((c) => [c.id, c.display_name]));
    }

    companionVisits = rows.map((v) => ({
      ...v,
      role: "companion" as const,
      companionOfName: primaryNameById.get(v.primary_customer_id) ?? null,
      companionNames: [],
    }));
  }

  const visits = [...primaryVisits, ...companionVisits]
    .sort((a, b) => (a.visited_at < b.visited_at ? 1 : -1))
    .slice(0, 20);

  const notes: NoteWithAuthor[] = (
    (notesRes.data ?? []) as unknown as (Note & {
      profiles: { display_name: string } | null;
    })[]
  ).map((n) => ({ ...n, authorName: n.profiles?.display_name ?? null }));

  // 同伴者として来店した時の「代表者のボトル」を取得する。
  // 店舗運用：代表者にボトルを登録したとき、同伴者もそのボトルを見える状態にする。
  let associatedBottles: AssociatedBottle[] = [];
  if (companionVisits.length > 0) {
    const primaryIds = [...new Set(companionVisits.map((v) => v.primary_customer_id))];
    if (primaryIds.length > 0) {
      const [assocBottlesRes, assocNamesRes] = await Promise.all([
        supabase
          .from("bottles")
          .select("*")
          .in("customer_id", primaryIds)
          .order("status", { ascending: true })
          .order("expiry_date", { ascending: true }),
        supabase
          .from("customers")
          .select("id, display_name")
          .in("id", primaryIds),
      ]);
      const nameById = new Map(
        ((assocNamesRes.data ?? []) as { id: string; display_name: string }[])
          .map((c) => [c.id, c.display_name])
      );
      associatedBottles = ((assocBottlesRes.data ?? []) as Bottle[]).map((b) => ({
        ...b,
        ownerName: nameById.get(b.customer_id) ?? "不明",
      }));
    }
  }

  return {
    customer,
    visits,
    bottles: (bottlesRes.data ?? []) as Bottle[],
    associatedBottles,
    champagnes: (champagnesRes.data ?? []) as Champagne[],
    notes,
    cautionRegisteredByName,
  };
}

export type NewCustomerInput = {
  display_name: string;
  kana?: string;
  real_name?: string;
  birthday?: string;
  memo?: string;
  aliases?: string[];
};

/** 顧客登録（第6章 基本情報）。 */
export async function createCustomer(input: NewCustomerInput) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: customer, error } = await supabase
    .from("customers")
    .insert({
      display_name: input.display_name,
      kana: input.kana || null,
      real_name: input.real_name || null,
      birthday: input.birthday || null,
      memo: input.memo || null,
      created_by: user?.id ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;

  const aliases = (input.aliases ?? []).map((a) => a.trim()).filter(Boolean);
  if (aliases.length > 0) {
    const { error: aliasError } = await supabase.from("customer_aliases").insert(
      aliases.map((alias) => ({ customer_id: customer.id, alias }))
    );
    if (aliasError) throw aliasError;
  }

  return customer as Customer;
}

/** 最近見た顧客の記録（第36章）。顧客詳細を開くたびに呼び出す。 */
export async function recordCustomerView(customerId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase
    .from("customer_views")
    .insert({ customer_id: customerId, viewed_by: user?.id ?? null });
}
