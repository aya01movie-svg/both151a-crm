import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { getDashboardData } from "@/lib/data/dashboard";
import { getMonthSummary } from "@/lib/data/calendar";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";
import { CalendarClient } from "@/components/calendar/CalendarClient";
import { DashboardSearch } from "@/components/dashboard/DashboardSearch";
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
  const dateLabel = `${dy}年${dm}月${dd}日(${dow})`;

  const [data, calData] = await Promise.all([
    getDashboardData(),
    getMonthSummary(year, month),
  ]);

  const todayVisits       = calData.days[todayJst]?.visits       ?? [];
  const todayReservations = calData.days[todayJst]?.reservations ?? [];

  return (
    <AppShell title="ホーム" staffName={profile.display_name} role={profile.role}>

      {/* 今月KPIのみ残し、今日の売上・チップは削除 */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {[
          { label: "今月売上",   value: yen(data.monthAmount),  sub: `${data.monthVisitCount}組` },
          { label: "今月チップ", value: yen(data.monthTip),     sub: "月合計" },
        ].map((k) => (
          <Card key={k.label} className="text-center py-3">
            <p className="text-xs text-navy/50 font-bold mb-1 truncate">{k.label}</p>
            <p className="text-xl sm:text-2xl font-black text-navy truncate">{k.value}</p>
            <p className="text-xs text-navy/40 mt-0.5">{k.sub}</p>
          </Card>
        ))}
      </div>

      <p className="text-center text-base font-black text-navy/70 mb-4">{dateLabel}</p>

      {/* 検索窓インライン化 */}
      <DashboardSearch />

      <div className="mb-5">
        <CalendarClient data={calData} />
      </div>

      <Card>
        {todayVisits.length === 0 && todayReservations.length === 0 && (
          <p className="text-navy/40 text-base py-2">まだ来店や予約はありません。</p>
        )}

        {/* 予約リスト */}
        {todayReservations.length > 0 && (
          <ul className="flex flex-col gap-2 mb-3">
            {todayReservations.map((r) => (
              <li key={r.id} className="flex items-center justify-between rounded-app bg-info/5 border border-info/20 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-black text-info text-2xl mb-1">予約</p>
                  <p className="font-black text-navy text-xl truncate">{r.customerName}</p>
                  <p className="text-sm text-navy/70 mt-1">
                    {r.time}
                    {r.companionNames.length > 0 && <span className="ml-2 font-black text-base">同伴: {r.companionNames.join("、")}</span>}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* 来店リスト */}
        {todayVisits.length > 0 && (
          <ul className="flex flex-col gap-2">
            {todayVisits.map((v) => (
              <li key={v.id} className="flex items-center justify-between rounded-app bg-success/5 border border-success/10 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-black text-success text-2xl mb-1">来店</p>
                  <p className="font-black text-navy text-xl truncate">
                    {v.hasChampagne && <span className="mr-1">🍾</span>}
                    {v.customerName}
                  </p>
                  <p className="text-sm text-navy/70 mt-1">
                    {v.time}
                    {v.companionNames.length > 0 && <span className="ml-2 font-black text-base">同伴: {v.companionNames.join("、")}</span>}
                  </p>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <p className="text-2xl font-black text-navy">{yen(v.amount)}</p>
                  <p className="text-sm font-bold text-navy/60 mt-1">売上 {v.amount.toLocaleString()}円</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </AppShell>
  );
}