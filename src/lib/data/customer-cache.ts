import { createClient } from "@/lib/supabase/server";

const CACHE_LIMIT = 1000;

export type CustomerCacheRecord = {
  id: string;
  display_name: string;
  kana: string | null;
  real_name: string | null;
  memo: string | null;
  favorite: boolean;
  rank: string;
  last_visit_at: string | null;
  visit_count: number;
  aliases: string[];
  tags: string[];
  receiptNames: string[];
};

/**
 * オフライン顧客検索用キャッシュデータの取得（第38章）。
 * 「最近閲覧・来店した顧客1000件は必ずオフライン検索できる」という要件のため、
 * last_visit_at が新しい順（未来店の新規登録者は created_at 順）に最大1000件を取得する。
 * 名前・ふりがな・本名・タグ・領収書宛名・メモを検索対象として同梱する。
 */
export async function getCustomerCacheData(): Promise<CustomerCacheRecord[]> {
  const supabase = await createClient();

  const { data: customers, error } = await supabase
    .from("customers")
    .select("id, display_name, kana, real_name, memo, favorite, rank, last_visit_at, visit_count, created_at")
    .eq("hidden", false)
    .order("last_visit_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(CACHE_LIMIT);

  if (error) throw error;
  const ids = (customers ?? []).map((c) => c.id);
  if (ids.length === 0) return [];

  const [aliasesRes, tagsRes, visitsRes] = await Promise.all([
    supabase.from("customer_aliases").select("customer_id, alias").in("customer_id", ids),
    supabase
      .from("customer_tags")
      .select("customer_id, tags(name)")
      .in("customer_id", ids),
    supabase
      .from("visits")
      .select("primary_customer_id, receipt_name, visited_at")
      .in("primary_customer_id", ids)
      .not("receipt_name", "is", null)
      .order("visited_at", { ascending: false })
      .limit(5000),
  ]);

  const aliasesByCustomer = new Map<string, string[]>();
  for (const row of aliasesRes.data ?? []) {
    const list = aliasesByCustomer.get(row.customer_id) ?? [];
    list.push(row.alias);
    aliasesByCustomer.set(row.customer_id, list);
  }

  const tagsByCustomer = new Map<string, string[]>();
  for (const row of (tagsRes.data ?? []) as unknown as {
    customer_id: string;
    tags: { name: string } | null;
  }[]) {
    if (!row.tags) continue;
    const list = tagsByCustomer.get(row.customer_id) ?? [];
    list.push(row.tags.name);
    tagsByCustomer.set(row.customer_id, list);
  }

  const receiptNamesByCustomer = new Map<string, string[]>();
  for (const row of (visitsRes.data ?? []) as unknown as {
    primary_customer_id: string;
    receipt_name: string | null;
  }[]) {
    if (!row.receipt_name) continue;
    const list = receiptNamesByCustomer.get(row.primary_customer_id) ?? [];
    if (!list.includes(row.receipt_name) && list.length < 5) list.push(row.receipt_name);
    receiptNamesByCustomer.set(row.primary_customer_id, list);
  }

  return (customers ?? []).map((c) => ({
    id: c.id,
    display_name: c.display_name,
    kana: c.kana,
    real_name: c.real_name,
    memo: c.memo,
    favorite: c.favorite,
    rank: c.rank,
    last_visit_at: c.last_visit_at,
    visit_count: c.visit_count,
    aliases: aliasesByCustomer.get(c.id) ?? [],
    tags: tagsByCustomer.get(c.id) ?? [],
    receiptNames: receiptNamesByCustomer.get(c.id) ?? [],
  }));
}
