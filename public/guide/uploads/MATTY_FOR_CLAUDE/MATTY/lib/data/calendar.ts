import { createClient } from "@/lib/supabase/server";
import { toJstDateString, toJstTimeString, jstDateRangeToUtcIso } from "@/lib/date";
import { listStoreEvents, listClosedDays, listHolidays, resolveEventDatesForMonth } from "@/lib/data/events";

export type CalendarVisitEntry = {
  id: string;
  customerId: string;
  customerName: string;
  companionNames: string[];
  amount: number;
  tip: number;
  time: string;
  hasChampagne: boolean; // 🍾表示フラグ
};

export type CalendarReservationEntry = {
  id: string;
  customerId: string;
  customerName: string;
  companionNames: string[];
  time: string;
  status: string;
  memo: string | null;
};

export type CalendarBirthdayEntry = {
  id: string;
  customerId: string;
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
  /** store/local/convention/sport/other タイプのイベント（staff は別フラグ） */
  events: { id: string; title: string; emoji: string; event_type: string; url?: string | null }[];
  /** スタッフ欠席イベント（event_type === "staff"） */
  staffEvents: { id: string; title: string; emoji: string; url?: string | null }[];
  isHoliday: boolean;
  holidayName: string | null;
  isClosedDay: boolean;
  closedNote: string | null;
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
    events: [],
    staffEvents: [],
    isHoliday: false,
    holidayName: null,
    isClosedDay: false,
    closedNote: null,
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

  const [visitsRes, reservationsRes, customersRes] = await Promise.all([
    supabase
      .from("visits")
      .select("id, visited_at, amount, tip, primary_customer_id")
      .eq("invalidated", false)
      .gte("visited_at", monthStartIso)
      .lt("visited_at", monthEndIso),
    supabase
      .from("reservations")
      .select("id, reserved_at, status, memo, customer_id")
      .neq("status", "cancelled")
      .gte("reserved_at", monthStartIso)
      .lt("reserved_at", monthEndIso),
    supabase
      .from("customers")
      .select("id, display_name, birthday")
      .eq("hidden", false)
      .not("birthday", "is", null),
  ]);

  const visitIds = ((visitsRes.data ?? []) as { id: string }[]).map((v) => v.id);

  // シャンパンが注文された visit_id を取得
  const champagneVisitIds = new Set<string>();
  if (visitIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: champRows } = await (supabase as any)
      .from("champagnes")
      .select("visit_id")
      .in("visit_id", visitIds);
    for (const row of (champRows ?? []) as { visit_id: string | null }[]) {
      if (row.visit_id) champagneVisitIds.add(row.visit_id);
    }
  }
  const reservationIds = ((reservationsRes.data ?? []) as { id: string }[]).map((r) => r.id);

  // 同伴者・予約同伴者名を2段クエリで取得（ネストembedは不安定なため）
  const [visitMemberRows, reservationMemberRows] = await Promise.all([
    visitIds.length > 0
      ? supabase
          .from("visit_members")
          .select("visit_id, customer_id")
          .in("visit_id", visitIds)
          .eq("member_type", "companion")
      : Promise.resolve({ data: [] as { visit_id: string; customer_id: string }[] }),
    reservationIds.length > 0
      ? supabase
          .from("reservation_members")
          .select("reservation_id, customer_id")
          .in("reservation_id", reservationIds)
      : Promise.resolve({ data: [] as { reservation_id: string; customer_id: string }[] }),
  ]);

  // 関連顧客名を一括取得
  const memberCustomerIds = [...new Set([
    ...(visitMemberRows.data ?? []).map((m: { customer_id: string }) => m.customer_id),
    ...(reservationMemberRows.data ?? []).map((m: { customer_id: string }) => m.customer_id),
  ])];
  const memberNameById = new Map<string, string>();
  if (memberCustomerIds.length > 0) {
    const { data: memberCustomers } = await supabase
      .from("customers")
      .select("id, display_name")
      .in("id", memberCustomerIds);
    for (const c of (memberCustomers ?? []) as { id: string; display_name: string }[]) {
      memberNameById.set(c.id, c.display_name);
    }
  }

  const visitCompanionsByVisit = new Map<string, string[]>();
  for (const row of (visitMemberRows.data ?? []) as { visit_id: string; customer_id: string }[]) {
    const name = memberNameById.get(row.customer_id);
    if (!name) continue;
    const list = visitCompanionsByVisit.get(row.visit_id) ?? [];
    list.push(name);
    visitCompanionsByVisit.set(row.visit_id, list);
  }

  const reservationCompanionsByReservation = new Map<string, string[]>();
  for (const row of (reservationMemberRows.data ?? []) as { reservation_id: string; customer_id: string }[]) {
    const name = memberNameById.get(row.customer_id);
    if (!name) continue;
    const list = reservationCompanionsByReservation.get(row.reservation_id) ?? [];
    list.push(name);
    reservationCompanionsByReservation.set(row.reservation_id, list);
  }

  // 来店・予約の顧客名を2段クエリで取得
  const visitRows = (visitsRes.data ?? []) as { id: string; visited_at: string; amount: number; tip: number; primary_customer_id: string }[];
  const reservationRows = (reservationsRes.data ?? []) as { id: string; reserved_at: string; status: string; memo: string | null; customer_id: string }[];

  const allVisitCustIds = [...new Set([
    ...visitRows.map((v) => v.primary_customer_id),
    ...reservationRows.map((r) => r.customer_id),
  ])];
  const calCustNameById = new Map<string, string>();
  if (allVisitCustIds.length > 0) {
    const { data: calCustData } = await supabase
      .from("customers")
      .select("id, display_name")
      .in("id", allVisitCustIds);
    for (const c of (calCustData ?? []) as { id: string; display_name: string }[]) {
      calCustNameById.set(c.id, c.display_name);
    }
  }
  const reservationCustomerNameById = calCustNameById; // 同じmapを再利用

  let monthTotalAmount = 0;
  let monthTotalTip = 0;

  for (const v of visitRows) {
    const dateStr = toJstDateString(v.visited_at);
    const day = days[dateStr];
    if (!day) continue;
    day.visits.push({
      id: v.id,
      customerId: v.primary_customer_id,
      customerName: calCustNameById.get(v.primary_customer_id) ?? "",
      companionNames: visitCompanionsByVisit.get(v.id) ?? [],
      amount: v.amount,
      tip: v.tip,
      time: toJstTimeString(v.visited_at),
      hasChampagne: champagneVisitIds.has(v.id),
    });
    day.totalAmount += v.amount;
    day.totalTip += v.tip;
    monthTotalAmount += v.amount;
    monthTotalTip += v.tip;
  }

  for (const r of reservationRows) {
    const dateStr = toJstDateString(r.reserved_at);
    const day = days[dateStr];
    if (!day) continue;
    day.reservations.push({
      id: r.id,
      customerId: r.customer_id,
      customerName: reservationCustomerNameById.get(r.customer_id) ?? "",
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
    day.birthdays.push({ id: c.id, customerId: c.id, customerName: c.display_name });
  }

  // イベント・祝日・店休日を並行取得してカレンダーマスに反映する
  const [storeEvents, closedDaysData, holidaysData] = await Promise.all([
    listStoreEvents(),
    listClosedDays(monthStart, monthEnd),
    listHolidays(monthStart, monthEnd),
  ]);

  const eventByDate = resolveEventDatesForMonth(storeEvents, year, month);
  for (const [dateStr, evList] of eventByDate) {
    const day = days[dateStr];
    if (!day) continue;
    for (const ev of evList) {
      if (ev.event_type === "staff") {
        day.staffEvents.push({ id: ev.id, title: ev.title, emoji: ev.emoji, url: ev.url });
      } else {
        day.events.push(ev);
      }
    }
  }

  for (const h of holidaysData) {
    const day = days[h.date];
    if (day) { day.isHoliday = true; day.holidayName = h.name; }
  }

  for (const cd of closedDaysData) {
    const day = days[cd.date];
    if (day) { day.isClosedDay = true; day.closedNote = cd.note; }
  }

  return { year, month, days, monthTotalAmount, monthTotalTip };
}
