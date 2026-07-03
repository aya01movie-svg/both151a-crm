import { createClient } from "@/lib/supabase/server";

export type TimelineEvent = {
  id: string;
  date: string; // ISO
  kind: "first_visit" | "visit" | "bottle" | "reservation" | "note" | "champagne";
  title: string;
  detail: string | null;
};

/**
 * 顧客タイムライン（レビュー指摘⑫、RC7修正⑫→②）。
 * 来店・ボトル追加・予約・メモ追加を時系列で統合する。
 * RC7修正: 代表者としての来店だけでなく、同伴者として来店した日も含める。
 * 「初回来店」は代表者/同伴者どちらの立場でも、最も古い来店日を採用する。
 */
export async function getCustomerTimeline(customerId: string): Promise<TimelineEvent[]> {
  const supabase = await createClient();

  const [
    primaryVisitsRes,
    companionMembershipsRes,
    bottlesRes,
    reservationsRes,
    notesRes,
    champagnesRes,
  ] = await Promise.all([
    supabase
      .from("visits")
      .select("id, visited_at, amount")
      .eq("primary_customer_id", customerId)
      .eq("invalidated", false)
      .order("visited_at", { ascending: true }),
    // RC8修正: visit_members→visits→customers という3段ネストのembedクエリは
    // 環境によって不安定なため、単純なクエリに分解してJS側で結合する
    // （他の箇所で実績のある確実なパターンに統一）。
    supabase
      .from("visit_members")
      .select("visit_id")
      .eq("customer_id", customerId)
      .eq("member_type", "companion"),
    supabase
      .from("bottles")
      .select("id, bottle_type, bottle_name, created_at")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: true }),
    supabase
      .from("reservations")
      .select("id, reserved_at, status, created_at")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: true }),
    supabase
      .from("notes")
      .select("id, note, created_at")
      .eq("customer_id", customerId)
      .eq("invalidated", false)
      .order("created_at", { ascending: true }),
    supabase
      .from("champagnes")
      .select("id, name, created_at")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: true }),
  ]);

  const events: TimelineEvent[] = [];

  const primaryVisits = (primaryVisitsRes.data ?? []) as {
    id: string;
    visited_at: string;
    amount: number;
  }[];

  const companionVisitIds = ((companionMembershipsRes.data ?? []) as { visit_id: string }[]).map(
    (m) => m.visit_id
  );

  let companionVisits: {
    id: string;
    visited_at: string;
    amount: number;
    primary_customer_id: string;
  }[] = [];
  let primaryNameById = new Map<string, string>();

  if (companionVisitIds.length > 0) {
    const { data: companionVisitRows } = await supabase
      .from("visits")
      .select("id, visited_at, amount, primary_customer_id")
      .in("id", companionVisitIds)
      .eq("invalidated", false);
    companionVisits = (companionVisitRows ?? []) as typeof companionVisits;

    const primaryIds = [...new Set(companionVisits.map((v) => v.primary_customer_id))];
    if (primaryIds.length > 0) {
      const { data: primaryCustomers } = await supabase
        .from("customers")
        .select("id, display_name")
        .in("id", primaryIds);
      primaryNameById = new Map((primaryCustomers ?? []).map((c) => [c.id, c.display_name]));
    }
  }

  // 代表者/同伴者どちらの立場かに関わらず、日時順に並べて最初の1件を「初回来店」とする
  type VisitOccurrence = { id: string; visited_at: string; amount: number; role: "primary" | "companion"; companionOfName: string | null };
  const allVisits: VisitOccurrence[] = [
    ...primaryVisits.map((v) => ({ ...v, role: "primary" as const, companionOfName: null })),
    ...companionVisits.map((v) => ({
      id: v.id,
      visited_at: v.visited_at,
      amount: v.amount,
      role: "companion" as const,
      companionOfName: primaryNameById.get(v.primary_customer_id) ?? null,
    })),
  ].sort((a, b) => (a.visited_at < b.visited_at ? -1 : 1));

  allVisits.forEach((v, i) => {
    const isFirst = i === 0;
    const roleNote = v.role === "companion" ? `代表者：${v.companionOfName ?? "不明"}様の同伴` : null;
    events.push({
      id: `visit-${v.role}-${v.id}`,
      date: v.visited_at,
      kind: isFirst ? "first_visit" : "visit",
      title: isFirst ? "初回来店" : v.role === "companion" ? "来店（同伴）" : "来店",
      detail: roleNote ?? `¥${v.amount.toLocaleString("ja-JP")}`,
    });
  });

  for (const b of (bottlesRes.data ?? []) as {
    id: string;
    bottle_type: string | null;
    bottle_name: string;
    created_at: string;
  }[]) {
    events.push({
      id: `bottle-${b.id}`,
      date: b.created_at,
      kind: "bottle",
      title: "ボトル追加",
      detail: b.bottle_type || b.bottle_name,
    });
  }

  const RESERVATION_STATUS_LABEL: Record<string, string> = {
    reserved: "予約",
    visited: "予約（来店済）",
    cancelled: "予約（キャンセル）",
  };
  for (const r of (reservationsRes.data ?? []) as {
    id: string;
    reserved_at: string;
    status: string;
    created_at: string;
  }[]) {
    events.push({
      id: `reservation-${r.id}`,
      date: r.created_at,
      kind: "reservation",
      title: RESERVATION_STATUS_LABEL[r.status] ?? "予約",
      detail: `予約日時：${r.reserved_at.slice(0, 16).replace("T", " ")}`,
    });
  }

  for (const n of (notesRes.data ?? []) as { id: string; note: string; created_at: string }[]) {
    events.push({
      id: `note-${n.id}`,
      date: n.created_at,
      kind: "note",
      title: "メモ追加",
      detail: n.note,
    });
  }

  for (const c of (champagnesRes.data ?? []) as { id: string; name: string; created_at: string }[]) {
    events.push({
      id: `champagne-${c.id}`,
      date: c.created_at,
      kind: "champagne",
      title: "シャンパン追加",
      detail: c.name,
    });
  }

  return events.sort((a, b) => (a.date < b.date ? 1 : -1));
}
