import { createClient } from "@/lib/supabase/server";
import { computePace } from "@/lib/pace";
import { jstDateRangeToUtcIso, toJstDateString, toJstTimeString } from "@/lib/date";

export type DashboardData = {
  todayAmount: number;
  todayTip: number;
  todayVisitCount: number;
  todayPeopleCount: number;
  yesterdayAmount: number;
  monthAmount: number;
  monthTip: number;
  monthVisitCount: number;
  monthPeopleCount: number;
  todayReservationCount: number;
  todayReservations: { id: string; customerName: string; peopleCount: number; time: string }[];
  upcomingBirthdays: {
    id: string;
    display_name: string;
    birthday: string;
    daysUntil: number;
  }[];
  vipNeedingFollowUp: {
    id: string;
    display_name: string;
    last_visit_at: string | null;
    paceLabel: string;
  }[];
};

/**
 * ホーム画面の実データ集計。
 * v1.1修正:
 *  - 昨日売上を追加（今日チップ→昨日売上に変更）
 *  - 誕生日を直近7日（JST基準）に変更
 *  - 月集計クエリの終端（lt nextMonth）を追加して翌月データが混入しないよう修正
 *  - 誕生日・昨日の日付計算をJST基準に統一
 *  - 最近見た顧客・最近よく来るお客様の集計を削除（ホームから削除）
 */
export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createClient();

  const now = new Date();
  const todayJst = toJstDateString(now.toISOString());

  // 今日
  const { startIso: todayStartIso, endIso: tomorrowStartIso } = jstDateRangeToUtcIso(todayJst);

  // 昨日
  const yesterdayJst = toJstDateString(new Date(now.getTime() - 86400000).toISOString());
  const { startIso: yesterdayStartIso, endIso: yesterdayEndIso } = jstDateRangeToUtcIso(yesterdayJst);

  // 今月（翌月初を終端として指定し、来月分が混入しないようにする）
  const monthStart = `${todayJst.slice(0, 7)}-01`;
  const { startIso: monthStartIso } = jstDateRangeToUtcIso(monthStart);
  const [y, m] = todayJst.slice(0, 7).split("-").map(Number);
  const nextMonthStr =
    m === 12
      ? `${y + 1}-01-01`
      : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const { startIso: nextMonthStartIso } = jstDateRangeToUtcIso(nextMonthStr);

  const [
    todayVisitsRes,
    yesterdayVisitsRes,
    monthVisitsRes,
    customersForBirthdayRes,
    todayReservationsRes,
    paceCandidatesRes,
  ] = await Promise.all([
    supabase
      .from("visits")
      .select("amount, tip, people_count")
      .eq("invalidated", false)
      .gte("visited_at", todayStartIso)
      .lt("visited_at", tomorrowStartIso),
    supabase
      .from("visits")
      .select("amount")
      .eq("invalidated", false)
      .gte("visited_at", yesterdayStartIso)
      .lt("visited_at", yesterdayEndIso),
    supabase
      .from("visits")
      .select("amount, tip, people_count")
      .eq("invalidated", false)
      .gte("visited_at", monthStartIso)
      .lt("visited_at", nextMonthStartIso),
    supabase
      .from("customers")
      .select("id, display_name, birthday")
      .eq("hidden", false)
      .not("birthday", "is", null),
    supabase
      .from("reservations")
      .select("id, reserved_at, people_count, customer_id")
      .eq("status", "reserved")
      .gte("reserved_at", todayStartIso)
      .lt("reserved_at", tomorrowStartIso)
      .order("reserved_at", { ascending: true }),
    supabase
      .from("customers")
      .select("id, display_name, last_visit_at, first_visit_at, visit_count, rank, favorite")
      .eq("hidden", false)
      .or("rank.eq.vip,favorite.eq.true")
      .gte("visit_count", 2),
  ]);

  const todayVisits = (todayVisitsRes.data ?? []) as {
    amount: number;
    tip: number;
    people_count: number;
  }[];
  const yesterdayVisits = (yesterdayVisitsRes.data ?? []) as { amount: number }[];
  const monthVisits = (monthVisitsRes.data ?? []) as {
    amount: number;
    tip: number;
    people_count: number;
  }[];

  const todayAmount = todayVisits.reduce((sum, v) => sum + v.amount, 0);
  const todayTip = todayVisits.reduce((sum, v) => sum + v.tip, 0);
  const todayPeopleCount = todayVisits.reduce((sum, v) => sum + v.people_count, 0);
  const yesterdayAmount = yesterdayVisits.reduce((sum, v) => sum + v.amount, 0);
  const monthAmount = monthVisits.reduce((sum, v) => sum + v.amount, 0);
  const monthTip = monthVisits.reduce((sum, v) => sum + v.tip, 0);
  const monthPeopleCount = monthVisits.reduce((sum, v) => sum + v.people_count, 0);


  // 今日の予約顧客名を2段クエリで取得（ネストembed排除）
  const todayResRows = (todayReservationsRes.data ?? []) as {
    id: string;
    reserved_at: string;
    people_count: number;
    customer_id: string;
  }[];
  const todayResCustIds = [...new Set(todayResRows.map((r) => r.customer_id))];
  const todayResCustNameById = new Map<string, string>();
  if (todayResCustIds.length > 0) {
    const { data: trcData } = await supabase
      .from("customers")
      .select("id, display_name")
      .in("id", todayResCustIds);
    for (const c of (trcData ?? []) as { id: string; display_name: string }[]) {
      todayResCustNameById.set(c.id, c.display_name);
    }
  }
  const todayReservations = todayResRows.map((r) => ({
    id: r.id,
    customerName: todayResCustNameById.get(r.customer_id) ?? "不明",
    peopleCount: r.people_count,
    time: toJstTimeString(r.reserved_at),
  }));
  // 誕生日: JST基準で今日から7日以内（today〜today+6）
  const todayYmd = Number(todayJst.slice(0, 4));
  const todayM = Number(todayJst.slice(5, 7));
  const todayD = Number(todayJst.slice(8, 10));
  const todayDateUTC = new Date(Date.UTC(todayYmd, todayM - 1, todayD));

  const upcomingBirthdays: DashboardData["upcomingBirthdays"] = [];
  for (const c of customersForBirthdayRes.data ?? []) {
    if (!c.birthday) continue;
    const bm = Number(c.birthday.slice(5, 7));
    const bd = Number(c.birthday.slice(8, 10));
    // 今年・来年それぞれの誕生日を確認する
    for (const yr of [todayYmd, todayYmd + 1]) {
      const bdDate = new Date(Date.UTC(yr, bm - 1, bd));
      const diff = Math.round((bdDate.getTime() - todayDateUTC.getTime()) / 86400000);
      if (diff >= 0 && diff <= 6) {
        upcomingBirthdays.push({ id: c.id, display_name: c.display_name, birthday: c.birthday, daysUntil: diff });
        break;
      }
    }
  }
  upcomingBirthdays.sort((a, b) => a.daysUntil - b.daysUntil);

  const vipNeedingFollowUp = (paceCandidatesRes.data ?? [])
    .map((c) => {
      const pace = computePace(c);
      return { id: c.id, display_name: c.display_name, last_visit_at: c.last_visit_at, pace };
    })
    .filter((c) => c.pace.isOverdue)
    .sort((a, b) => (b.pace.elapsedDays ?? 0) - (a.pace.elapsedDays ?? 0))
    .slice(0, 5)
    .map((c) => ({
      id: c.id,
      display_name: c.display_name,
      last_visit_at: c.last_visit_at,
      paceLabel: c.pace.label,
    }));

  return {
    todayAmount,
    todayTip,
    todayVisitCount: todayVisits.length,
    todayPeopleCount,
    yesterdayAmount,
    monthAmount,
    monthTip,
    monthVisitCount: monthVisits.length,
    monthPeopleCount,
    todayReservationCount: todayReservations.length,
    todayReservations,
    upcomingBirthdays,
    vipNeedingFollowUp,
  };
}

/** 月別売上・来店人数（折れ線グラフ用：今年・昨年12ヶ月分） */
export type MonthlyGraphData = {
  month: number; // 1-12
  thisYearAmount: number;
  lastYearAmount: number;
  thisYearPeople: number;
};

export async function getMonthlyGraphData(): Promise<MonthlyGraphData[]> {
  const supabase = await createClient();
  const now = new Date();
  const todayJst = toJstDateString(now.toISOString());
  const thisYear = Number(todayJst.slice(0, 4));

  const { startIso: thisYearStart } = jstDateRangeToUtcIso(`${thisYear}-01-01`);
  const { startIso: lastYearStart } = jstDateRangeToUtcIso(`${thisYear - 1}-01-01`);
  const { startIso: lastYearEnd }   = jstDateRangeToUtcIso(`${thisYear}-01-01`);

  const [thisYearRes, lastYearRes] = await Promise.all([
    supabase.from("visits").select("visited_at, amount, people_count").eq("invalidated", false).gte("visited_at", thisYearStart),
    supabase.from("visits").select("visited_at, amount").eq("invalidated", false).gte("visited_at", lastYearStart).lt("visited_at", lastYearEnd),
  ]);

  const thisYearByMonth: { amount: number; people: number }[] = Array.from({ length: 12 }, () => ({ amount: 0, people: 0 }));
  const lastYearByMonth: number[] = Array(12).fill(0);

  for (const v of (thisYearRes.data ?? []) as { visited_at: string; amount: number; people_count: number }[]) {
    const mo = Number(toJstDateString(v.visited_at).slice(5, 7)) - 1;
    thisYearByMonth[mo].amount += v.amount;
    thisYearByMonth[mo].people += v.people_count;
  }
  for (const v of (lastYearRes.data ?? []) as { visited_at: string; amount: number }[]) {
    const mo = Number(toJstDateString(v.visited_at).slice(5, 7)) - 1;
    lastYearByMonth[mo] += v.amount;
  }

  return Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    thisYearAmount: thisYearByMonth[i].amount,
    lastYearAmount: lastYearByMonth[i],
    thisYearPeople: thisYearByMonth[i].people,
  }));
}
