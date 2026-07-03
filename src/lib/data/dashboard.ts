import { createClient } from "@/lib/supabase/server";
import type { Customer } from "@/types/database";
import { computePace } from "@/lib/pace";
import { getExpiryTier } from "@/lib/bottle-expiry";
import { jstDateRangeToUtcIso, toJstDateString } from "@/lib/date";

export type DashboardData = {
  todayAmount: number;
  todayTip: number;
  todayVisitCount: number; // 組数
  todayPeopleCount: number; // 人数
  monthAmount: number;
  monthTip: number;
  monthVisitCount: number;
  todayReservationCount: number;
  /** ボトル期限の色分け件数（ご指定仕様：期限切れ/7日以内/14日以内/30日以内） */
  bottlesExpired: number;
  bottlesWithin7: number;
  bottlesWithin14: number;
  bottlesWithin30: number;
  tomorrowBirthdays: Pick<Customer, "id" | "display_name">[];
  todayBirthdays: Pick<Customer, "id" | "display_name">[];
  recentlyViewed: Pick<
    Customer,
    "id" | "display_name" | "rank" | "last_visit_at" | "favorite"
  >[];
  frequentVisitors: {
    id: string;
    display_name: string;
    visitCount: number;
  }[];
  vipNeedingFollowUp: {
    id: string;
    display_name: string;
    last_visit_at: string | null;
    paceLabel: string;
  }[];
};

/**
 * ホーム画面（第3章・第14章・第25章・第27章・第36章・第37章）の実データ集計。
 * 「本日の予約件数」は予約管理（Phase C）と接続済み。
 * 「来店ペースを超えて来店していないVIP・お気に入り」（第25章・第27章）は
 * computePace() による平均来店周期（累計来店回数・初回/最終来店日から算出）を用いて判定する。
 *
 * RC8修正: 「今日」の範囲はサーバーのUTC日付ではなく日本時間（Asia/Tokyo）基準で
 * 判定する（深夜営業のバーでは特に、UTC基準だと日付がズレて集計が崩れるため）。
 */
export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createClient();

  const now = new Date();
  const todayJst = toJstDateString(now.toISOString());
  const { startIso: todayStartIso, endIso: tomorrowStartIso } = jstDateRangeToUtcIso(todayJst);
  const monthStart = `${todayJst.slice(0, 7)}-01`;
  const { startIso: monthStartIso } = jstDateRangeToUtcIso(monthStart);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const threeMonthsAgo = new Date(now);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const [
    todayVisitsRes,
    monthVisitsRes,
    bottlesRes,
    customersForBirthdayRes,
    recentViewsRes,
    frequentVisitsRes,
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
      .select("amount, tip")
      .eq("invalidated", false)
      .gte("visited_at", monthStartIso),
    supabase.from("bottles").select("expiry_date, status").eq("status", "kept"),
    // 誕生日はyear非依存で月日一致を見る必要があるため、必要列だけ取得してJS側で判定する
    // （customersは500件規模のためDB→アプリ間の転送コストも小さい）
    supabase
      .from("customers")
      .select("id, display_name, birthday")
      .eq("hidden", false)
      .not("birthday", "is", null),
    supabase
      .from("customer_views")
      .select("customer_id, viewed_at")
      .order("viewed_at", { ascending: false })
      .limit(40),
    supabase
      .from("visits")
      .select("primary_customer_id")
      .eq("invalidated", false)
      .gte("visited_at", threeMonthsAgo.toISOString()),
    supabase
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .eq("status", "reserved")
      .gte("reserved_at", todayStartIso)
      .lt("reserved_at", tomorrowStartIso),
    // 第25章・第27章: VIP または お気に入りのうち、来店実績が2回以上ある顧客を
    // 来店ペース判定の候補として取得する（判定自体はJS側のcomputePaceで行う）
    supabase
      .from("customers")
      .select("id, display_name, last_visit_at, first_visit_at, visit_count, rank, favorite")
      .eq("hidden", false)
      .or("rank.eq.vip,favorite.eq.true")
      .gte("visit_count", 2),
  ]);

  const todayVisits = todayVisitsRes.data ?? [];
  const monthVisits = monthVisitsRes.data ?? [];
  const bottles = bottlesRes.data ?? [];

  const todayAmount = todayVisits.reduce((sum, v) => sum + v.amount, 0);
  const todayTip = todayVisits.reduce((sum, v) => sum + v.tip, 0);
  const todayPeopleCount = todayVisits.reduce((sum, v) => sum + v.people_count, 0);
  const monthAmount = monthVisits.reduce((sum, v) => sum + v.amount, 0);
  const monthTip = monthVisits.reduce((sum, v) => sum + v.tip, 0);

  // ボトル期限の色分け件数（ご指定仕様：排他的な4段階。31日以上の🟢は通知対象外のため集計しない）
  const bottleTiers = bottles.map((b) => getExpiryTier(b.expiry_date));
  const bottlesExpired = bottleTiers.filter((t) => t === "expired").length;
  const bottlesWithin7 = bottleTiers.filter((t) => t === "within7").length;
  const bottlesWithin14 = bottleTiers.filter((t) => t === "within14").length;
  const bottlesWithin30 = bottleTiers.filter((t) => t === "within30").length;

  const tomorrowMonth = tomorrow.getMonth() + 1;
  const tomorrowDate = tomorrow.getDate();
  const todayMonth = now.getMonth() + 1;
  const todayDate = now.getDate();
  const birthdayCustomers = customersForBirthdayRes.data ?? [];
  const tomorrowBirthdays = birthdayCustomers.filter((c) => {
    if (!c.birthday) return false;
    const [, m, d] = c.birthday.split("-").map(Number);
    return m === tomorrowMonth && d === tomorrowDate;
  });
  // 第13章: 当日は「本日誕生日」として別枠で表示する
  const todayBirthdays = birthdayCustomers.filter((c) => {
    if (!c.birthday) return false;
    const [, m, d] = c.birthday.split("-").map(Number);
    return m === todayMonth && d === todayDate;
  });

  // 最近見た顧客: customer_views から重複除去して最大10件
  const viewedIds: string[] = [];
  for (const row of recentViewsRes.data ?? []) {
    if (!viewedIds.includes(row.customer_id)) viewedIds.push(row.customer_id);
    if (viewedIds.length >= 10) break;
  }
  let recentlyViewed: DashboardData["recentlyViewed"] = [];
  if (viewedIds.length > 0) {
    const { data } = await supabase
      .from("customers")
      .select("id, display_name, rank, last_visit_at, favorite")
      .in("id", viewedIds);
    const byId = new Map((data ?? []).map((c) => [c.id, c]));
    recentlyViewed = viewedIds.map((id) => byId.get(id)).filter(Boolean) as DashboardData["recentlyViewed"];
  }

  // 最近よく来るお客様（過去3か月・第37章）
  const visitCountByCustomer = new Map<string, number>();
  for (const row of frequentVisitsRes.data ?? []) {
    visitCountByCustomer.set(
      row.primary_customer_id,
      (visitCountByCustomer.get(row.primary_customer_id) ?? 0) + 1
    );
  }
  const topCustomerIds = [...visitCountByCustomer.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([id]) => id);

  let frequentVisitors: DashboardData["frequentVisitors"] = [];
  if (topCustomerIds.length > 0) {
    const { data } = await supabase
      .from("customers")
      .select("id, display_name")
      .in("id", topCustomerIds);
    const nameById = new Map((data ?? []).map((c) => [c.id, c.display_name]));
    frequentVisitors = topCustomerIds.map((id) => ({
      id,
      display_name: nameById.get(id) ?? "",
      visitCount: visitCountByCustomer.get(id) ?? 0,
    }));
  }

  // 第25章・第27章: 平均来店周期を超えて来店していないVIP・お気に入りを抽出する
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
    monthAmount,
    monthTip,
    monthVisitCount: monthVisits.length,
    todayReservationCount: todayReservationsRes.count ?? 0,
    bottlesExpired,
    bottlesWithin7,
    bottlesWithin14,
    bottlesWithin30,
    tomorrowBirthdays,
    todayBirthdays,
    recentlyViewed,
    frequentVisitors,
    vipNeedingFollowUp,
  };
}
