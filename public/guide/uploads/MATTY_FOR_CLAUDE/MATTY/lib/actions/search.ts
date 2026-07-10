"use server";

import { listCustomers } from "@/lib/data/customers";
import { createClient } from "@/lib/supabase/server";

/**
 * 検索結果に「同伴履歴」を付与する（レビュー指摘5）。
 * 同伴者として検索にヒットした顧客について、一緒に来店した代表者名を
 * 検索結果に添えることで「誰と来店したか」がすぐ分かるようにする。
 */
export async function searchCustomersOnlineAction(query: string) {
  const { customers } = await listCustomers({ search: query, page: 0 });

  const supabase = await createClient();
  const ids = customers.map((c) => c.id);

  let cameWithByCustomer = new Map<string, string[]>();
  if (ids.length > 0) {
    const { data: memberships } = await supabase
      .from("visit_members")
      .select("customer_id, visit_id")
      .in("customer_id", ids)
      .eq("member_type", "companion")
      .limit(200);

    const membershipRows = (memberships ?? []) as { customer_id: string; visit_id: string }[];
    const visitIds = [...new Set(membershipRows.map((m) => m.visit_id))];

    if (visitIds.length > 0) {
      const { data: visits } = await supabase
        .from("visits")
        .select("id, primary_customer_id")
        .in("id", visitIds);
      const visitRows = (visits ?? []) as { id: string; primary_customer_id: string }[];
      const primaryIdByVisit = new Map(visitRows.map((v) => [v.id, v.primary_customer_id]));

      const primaryIds = [...new Set(visitRows.map((v) => v.primary_customer_id))];
      const { data: primaryCustomers } = await supabase
        .from("customers")
        .select("id, display_name")
        .in("id", primaryIds);
      const nameByPrimaryId = new Map((primaryCustomers ?? []).map((c) => [c.id, c.display_name]));

      cameWithByCustomer = new Map();
      for (const m of membershipRows) {
        const primaryId = primaryIdByVisit.get(m.visit_id);
        const primaryName = primaryId ? nameByPrimaryId.get(primaryId) : undefined;
        if (!primaryName) continue;
        const list = cameWithByCustomer.get(m.customer_id) ?? [];
        if (!list.includes(primaryName)) list.push(primaryName);
        cameWithByCustomer.set(m.customer_id, list);
      }
    }
  }

  return customers.map((c) => ({
    id: c.id,
    display_name: c.display_name,
    kana: c.kana,
    real_name: c.real_name,
    favorite: c.favorite,
    rank: c.rank,
    last_visit_at: c.last_visit_at,
    visit_count: c.visit_count,
    tags: c.tags.map((t) => t.name),
    cameWithNames: (cameWithByCustomer.get(c.id) ?? []).slice(0, 3),
  }));
}
