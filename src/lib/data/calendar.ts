import { createClient } from "@/lib/supabase/server";
import { toJstDateString, toJstTimeString, jstDateRangeToUtcIso } from "@/lib/date";

export type CalendarVisitEntry = {
  id: string;
  customerName: string;
  companionNames: string[];
  amount: number;
  tip: number;
  time: string;
};

export type CalendarReservationEntry = {
  id: string;
  customerName: string;
  companionNames: string[];
  time: string;
  status: string;
  memo: string | null;
};

export type CalendarBirthdayEntry = {
  id: string;
  customerName: string;
};

export type CalendarBottleEntry = {
  id: string;
  customerName: string;
  bottleLabel: string;
};

export type CalendarDayData = {
  date: string; // YYYY-MM-DD
  visits: CalendarVisitEntry[];
  reservations: CalendarReservationEntry[];
  birthdays: CalendarBirthdayEntry[];
  bottleExpiries: CalendarBottleEntry[];
  totalAmount: number;
  totalTip: number;
};

export type CalendarMonthData = {
  year: number;
  month: number; // 1-12
  days: Record<string, CalendarDayData>;
  monthTotalAmount: number;
  monthTotalTip: number;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function emptyDay(date: string): CalendarDayData {
  return {
    date,
    visits: [],
    reservations: [],
    birthdays: [],
    bottleExpiries: [],
    totalAmount: 0,
    totalTip: 0,
  };
}

/** カレンダー月間データ（第13章：来店・予約・誕生日・ボトル期限・売上/チップ合計）。 */
export async function getMonthSummary(year: number, month: number): Promise<CalendarMonthData> {
  const supabase = await createClient();

  const monthStart = `${year}-${pad2(month)}-01`;
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthEnd = `${year}-${pad2(month)}-${pad2(daysInMonth)}`;

  // RC8修正: 日本時間の月初0:00〜翌月初0:00（exclusive）をUTCへ変換してクエリする
  const { startIso: monthStartIso } = jstDateRangeToUtcIso(monthStart);
  const { endIso: monthEndIso } = jstDateRangeToUtcIso(monthEnd);

  const days: Record<string, CalendarDayData> = {};
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${pad2(month)}-${pad2(d)}`;
    days[dateStr] = emptyDay(dateStr);
  }

  const [visitsRes, reservationsRes, customersRes, bottlesRes] = await Promise.all([
    supabase
      .from("visits")
      .select("id, visited_at, amount, tip, customers:primary_customer_id(display_name)")
      .eq("invalidated", false)
      .gte("visited_at", monthStartIso)
      .lt("visited_at", monthEndIso),
    supabase
      .from("reservations")
      .select("id, reserved_at, status, memo, customers(display_name)")
      .neq("status", "cancelled")
      .gte("reserved_at", monthStartIso)
      .lt("reserved_at", monthEndIso),
    supabase
      .from("customers")
      .select("id, display_name, birthday")
      .eq("hidden", false)
      .not("birthday", "is", null),
    supabase
      .from("bottles")
      .select("id, bottle_type, bottle_name, expiry_date, customers(display_name)")
      .eq("status", "kept")
      .gte("expiry_date", monthStart)
      .lte("expiry_date", monthEnd),
  ]);

  const visitIds = ((visitsRes.data ?? []) as { id: string }[]).map((v) => v.id);
  const reservationIds = ((reservationsRes.data ?? []) as { id: string }[]).map((r) => r.id);

  const [visitCompanionsRes, reservationCompanionsRes] = await Promise.all([
    visitIds.length > 0
      ? supabase
          .from("visit_members")
          .select("visit_id, customers(display_name)")
          .in("visit_id", visitIds)
          .eq("member_type", "companion")
      : Promise.resolve({ data: [] as unknown[] }),
    reservationIds.length > 0
      ? supabase
          .from("reservation_members")
          .select("reservation_id, customers(display_name)")
          .in("reservation_id", reservationIds)
      : Promise.resolve({ data: [] as unknown[] }),
  ]);

  const visitCompanionsByVisit = new Map<string, string[]>();
  for (const row of (visitCompanionsRes.data ?? []) as unknown as {
    visit_id: string;
    customers: { display_name: string } | null;
  }[]) {
    const list = visitCompanionsByVisit.get(row.visit_id) ?? [];
    if (row.customers) list.push(row.customers.display_name);
    visitCompanionsByVisit.set(row.visit_id, list);
  }

  const reservationCompanionsByReservation = new Map<string, string[]>();
  for (const row of (reservationCompanionsRes.data ?? []) as unknown as {
    reservation_id: string;
    customers: { display_name: string } | null;
  }[]) {
    const list = reservationCompanionsByReservation.get(row.reservation_id) ?? [];
    if (row.customers) list.push(row.customers.display_name);
    reservationCompanionsByReservation.set(row.reservation_id, list);
  }

  let monthTotalAmount = 0;
  let monthTotalTip = 0;

  for (const v of (visitsRes.data ?? []) as unknown as {
    id: string;
    visited_at: string;
    amount: number;
    tip: number;
    customers: { display_name: string } | null;
  }[]) {
    const dateStr = toJstDateString(v.visited_at);
    const day = days[dateStr];
    if (!day) continue;
    day.visits.push({
      id: v.id,
      customerName: v.customers?.display_name ?? "",
      companionNames: visitCompanionsByVisit.get(v.id) ?? [],
      amount: v.amount,
      tip: v.tip,
      time: toJstTimeString(v.visited_at),
    });
    day.totalAmount += v.amount;
    day.totalTip += v.tip;
    monthTotalAmount += v.amount;
    monthTotalTip += v.tip;
  }

  for (const r of (reservationsRes.data ?? []) as unknown as {
    id: string;
    reserved_at: string;
    status: string;
    memo: string | null;
    customers: { display_name: string } | null;
  }[]) {
    const dateStr = toJstDateString(r.reserved_at);
    const day = days[dateStr];
    if (!day) continue;
    day.reservations.push({
      id: r.id,
      customerName: r.customers?.display_name ?? "",
      companionNames: reservationCompanionsByReservation.get(r.id) ?? [],
      time: toJstTimeString(r.reserved_at),
      status: r.status,
      memo: r.memo,
    });
  }

  for (const c of (customersRes.data ?? []) as { id: string; display_name: string; birthday: string | null }[]) {
    if (!c.birthday) continue;
    const [, m, d] = c.birthday.split("-");
    if (Number(m) !== month) continue;
    const dateStr = `${year}-${pad2(month)}-${d}`;
    const day = days[dateStr];
    if (!day) continue;
    day.birthdays.push({ id: c.id, customerName: c.display_name });
  }

  for (const b of (bottlesRes.data ?? []) as unknown as {
    id: string;
    bottle_type: string | null;
    bottle_name: string;
    expiry_date: string;
    customers: { display_name: string } | null;
  }[]) {
    const day = days[b.expiry_date];
    if (!day) continue;
    day.bottleExpiries.push({
      id: b.id,
      customerName: b.customers?.display_name ?? "",
      bottleLabel: b.bottle_type || b.bottle_name,
    });
  }

  return { year, month, days, monthTotalAmount, monthTotalTip };
}
