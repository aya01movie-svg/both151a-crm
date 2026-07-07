import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { getDashboardData } from "@/lib/data/dashboard";
import { getMonthSummary } from "@/lib/data/calendar";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";
import { CalendarClient } from "@/components/calendar/CalendarClient";
import { toJstDateString, yen } from "@/lib/date";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const WEEKDAY_JA = ["日", "月", "火", "水", "木", "金", "土"];

export default async function DashboardPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const now      = new Date();
  const todayJst = toJstDateString(now.toISOString());
  const year     = Number(todayJst.slice(0, 4));
  const month    = Number(todayJst.slice(5, 7));
  const [dy, dm, dd] = todayJst.split("-").map(Number);
  const dow = WEEKDAY_JA[new Date(dy, dm - 1, dd).getDay()];
  const dateLabel = `${dy}年${dm}月${dd}日（${dow}）`;

  const [data, calData] = await Promise.all([
    getDashboardData(),
    getMonthSummary(year, month),
  ]);

  const todayVisits       = calData.days[todayJst]?.visits       ?? [];
  const todayReservations = calData.days[todayJst]?.reservations ?? [];

  return (
    <AppShell title="ホーム" staffName={profile.display_name} role={profile.role}>

      {/* ── KPI ──────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {[
          { label: "今日売上",   value: yen(data.todayAmount),  sub: `${data.todayVisitCount}組 ${data.todayPeopleCount}名` },
          { label: "今月売上",   value: yen(data.monthAmount),  sub: `${data.monthVisitCount}組` },
          { label: "今日チップ", value: yen(data.todayTip),     sub: "本日" },
          { label: "今月チップ", value: yen(data.monthTip),     sub: "月合計" },
        ].map((k) => (
          <Card key={k.label} className="text-center py-3">
            <p className="text-xs text-navy/50 font-bold mb-1 truncate">{k.label}</p>
            <p className="text-xl sm:text-2xl font-black text-navy truncate">{k.value}</p>
            <p className="text-xs text-navy/40 mt-0.5">{k.sub}</p>
          </Card>
        ))}
      </div>

      {/* ── 日付 ──────────────────────────────── */}
      <p className="text-center text-base font-bold text-navy/70 mb-4">{dateLabel}</p>

      {/* ── 検索窓 ──────────────────────────────── */}
      <form action="/search" method="get" className="mb-5">
        <div className="flex gap-2">
          <input
            type="text"
            name="q"
            placeholder="顧客名・タグ・ボトル名で検索…"
            className="flex-1 min-h-14 rounded-app border-2 border-navy/10 bg-white px-5
                       text-base text-navy placeholder:text-navy/30
                       focus:outline-none focus:border-gold transition-colors"
          />
          <button
            type="submit"
            className="min-h-14 px-5 rounded-app bg-gold text-navy font-black text-base"
          >
            🔍
          </button>
        </div>
      </form>

      {/* ── カレンダー ──────────────────────────────── */}
      <div className="mb-5">
        <CalendarClient data={calData} />
      </div>

      {/* ── 本日の来店・予約一覧 ──────────────────────────────── */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-black text-navy">本日の来店 / 予約</h2>
          <span className="text-sm text-navy/40">
            来店 {todayVisits.length} / 予約 {todayReservations.length}
          </span>
        </div>

        {todayVisits.length === 0 && todayReservations.length === 0 && (
          <p className="text-navy/40 text-base py-2">まだ来店・予約はありません。</p>
        )}

        {/* 予約 */}
        {todayReservations.length > 0 && (
          <ul className="flex flex-col gap-2 mb-3">
            {todayReservations.map((r) => (
              <li key={r.id}
                  className="flex items-center justify-between
                             rounded-app bg-info/5 border border-info/20 px-4 py-3">
                <div>
                  <p className="font-black text-navy text-base">{r.customerName}</p>
                  <p className="text-xs text-navy/50 mt-0.5">
                    {r.time}
                    {r.companionNames.length > 0 && `　同伴: ${r.companionNames.join("、")}`}
                  </p>
                </div>
                <span className="text-xs font-bold text-info bg-info/10 px-2 py-1 rounded-full shrink-0">
                  予約中
                </span>
              </li>
            ))}
          </ul>
        )}

        {/* 来店済み */}
        {todayVisits.length > 0 && (
          <ul className="flex flex-col gap-2">
            {todayVisits.map((v) => (
              <li key={v.id}
                  className="flex items-center justify-between
                             rounded-app bg-success/5 border border-success/10 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-black text-navy text-base truncate">
                    {v.hasChampagne && <span className="mr-1">🍾</span>}
                    {v.customerName}
                  </p>
                  <p className="text-xs text-navy/50 mt-0.5">
                    {v.time}
                    {v.companionNames.length > 0 && `　同伴: ${v.companionNames.join("、")}`}
                  </p>
                </div>
                <p className="text-base font-black text-navy shrink-0 ml-2">{yen(v.amount)}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

    </AppShell>
  );
}
