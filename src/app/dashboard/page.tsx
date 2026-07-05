import Image from "next/image";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { getDashboardData, getMonthlyGraphData } from "@/lib/data/dashboard";
import { listStoreEvents, listClosedDays, listHolidays, buildNoticeItems } from "@/lib/data/events";
import { MonthlyLineChart } from "@/components/dashboard/MonthlyLineChart";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { toJstDateString } from "@/lib/date";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function yen(n: number) {
  return `¥${n.toLocaleString("ja-JP")}`;
}

const WEEKDAY_JA = ["日", "月", "火", "水", "木", "金", "土"];

function birthdayLabel(birthday: string): string {
  const bm = Number(birthday.slice(5, 7));
  const bd = Number(birthday.slice(8, 10));
  const now = new Date();
  const yr =
    bm < now.getMonth() + 1 ||
    (bm === now.getMonth() + 1 && bd < now.getDate())
      ? now.getFullYear() + 1
      : now.getFullYear();
  const d = new Date(yr, bm - 1, bd);
  return `${bm}/${bd}(${WEEKDAY_JA[d.getDay()]})`;
}

export default async function DashboardPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const now = new Date();
  const todayJst = toJstDateString(now.toISOString());
  const cdFrom = new Date(now);
  cdFrom.setDate(cdFrom.getDate() - 1);
  const cdTo = new Date(now);
  cdTo.setDate(cdTo.getDate() + 14);

  const [data, events, closedDays, holidays, graphData] = await Promise.all([
    getDashboardData(),
    listStoreEvents(),
    listClosedDays(cdFrom.toISOString().slice(0, 10), cdTo.toISOString().slice(0, 10)),
    listHolidays(cdFrom.toISOString().slice(0, 10), cdTo.toISOString().slice(0, 10)),
    getMonthlyGraphData(),
  ]);

  const noticeItems = buildNoticeItems({ todayStr: todayJst, events, closedDays, holidays });

  const kpis = [
    {
      label: "今日売上",
      value: yen(data.todayAmount),
      sub: `${data.todayVisitCount}組 / ${data.todayPeopleCount}名`,
    },
    { label: "昨日売上", value: yen(data.yesterdayAmount), sub: "前日実績" },
    { label: "今月売上", value: yen(data.monthAmount), sub: `${data.monthVisitCount}組` },
    { label: "今月チップ", value: yen(data.monthTip), sub: "月合計" },
    { label: "本日予約", value: `${data.todayReservationCount}件`, sub: "予約管理より" },
  ];

  const hasBottleNotice =
    data.bottlesExpired > 0 ||
    data.bottlesWithin7 > 0 ||
    data.bottlesWithin14 > 0 ||
    data.bottlesWithin30 > 0;
  const hasNotice =
    hasBottleNotice ||
    data.upcomingBirthdays.length > 0 ||
    data.todayReservationCount > 0 ||
    noticeItems.length > 0;

  return (
    <AppShell title="ホーム" staffName={profile.display_name} role={profile.role}>
      {/* KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {kpis.map((k) => (
          <Card key={k.label} className="text-center min-w-0 overflow-hidden">
            <p className="text-navy/50 text-xs font-bold mb-1 truncate">{k.label}</p>
            <p className="text-navy text-lg sm:text-xl font-black truncate">{k.value}</p>
            <p className="text-navy/40 text-[11px] mt-0.5 truncate">{k.sub}</p>
          </Card>
        ))}
      </div>

      {/* MATTYからお知らせ */}
      <Card className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Image
            src="/icons/matty-transparent-96.png"
            alt="MATTY"
            width={56}
            height={56}
            className="shrink-0 opacity-90"
          />
          <h2 className="text-base font-black text-navy">MATTYからお知らせ</h2>
        </div>

        {!hasNotice && (
          <p className="text-navy/40 text-sm">今日はお知らせはありません。</p>
        )}

        <ul className="flex flex-col gap-3">
          {data.todayReservationCount > 0 && (
            <li className="flex items-start gap-3 p-3 rounded-app bg-[#e8f0fb]">
              <span className="text-2xl leading-none">📅</span>
              <div>
                <p className="font-black text-navy text-sm">本日の予約</p>
                <p className="text-navy/60 text-sm">{data.todayReservationCount}件あります</p>
              </div>
            </li>
          )}

          {data.upcomingBirthdays.map((c) => (
            <li key={c.id} className="flex items-start gap-3 p-3 rounded-app bg-[#fce8f3]">
              <span className="text-2xl leading-none">🎂</span>
              <div>
                <p className="font-black text-navy text-sm">
                  {c.daysUntil === 0 ? "🎉 本日誕生日！" : `${c.daysUntil}日後に誕生日`}
                </p>
                <p className="text-navy/70 text-sm font-bold">
                  {birthdayLabel(c.birthday)}　{c.display_name}様
                </p>
              </div>
            </li>
          ))}

          {data.bottlesExpired > 0 && (
            <li className="flex items-start gap-3 p-3 rounded-app bg-[#f5e8e8]">
              <span className="text-2xl leading-none">🍷</span>
              <div>
                <p className="font-black text-danger text-sm">期限切れボトル</p>
                <p className="text-navy/60 text-sm">{data.bottlesExpired}本</p>
              </div>
            </li>
          )}
          {data.bottlesWithin7 > 0 && (
            <li className="flex items-start gap-3 p-3 rounded-app bg-[#fde8e8]">
              <span className="text-2xl leading-none">🍷</span>
              <div>
                <p className="font-black text-danger text-sm">7日以内に期限切れ</p>
                <p className="text-navy/60 text-sm">{data.bottlesWithin7}本</p>
              </div>
            </li>
          )}
          {data.bottlesWithin14 > 0 && (
            <li className="flex items-start gap-3 p-3 rounded-app bg-[#fef3e2]">
              <span className="text-2xl leading-none">🍷</span>
              <div>
                <p className="font-black text-[#b58a05] text-sm">14日以内に期限切れ</p>
                <p className="text-navy/60 text-sm">{data.bottlesWithin14}本</p>
              </div>
            </li>
          )}
          {data.bottlesWithin30 > 0 && (
            <li className="flex items-start gap-3 p-3 rounded-app bg-[#fef3e2]">
              <span className="text-2xl leading-none">🍷</span>
              <div>
                <p className="font-bold text-warn text-sm">30日以内に期限切れ</p>
                <p className="text-navy/60 text-sm">{data.bottlesWithin30}本</p>
              </div>
            </li>
          )}

          {noticeItems.map((item) => (
            <li
              key={item.key}
              className={`flex items-start gap-3 p-3 rounded-app ${item.colorClass}`}
            >
              <span className="text-2xl leading-none">{item.emoji}</span>
              <div>
                <p className="font-black text-navy text-sm">{item.title}</p>
                <p className="text-navy/60 text-sm">{item.subtitle}</p>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      {/* 月別折れ線グラフ（③） */}
      <Card className="mb-6">
        <h2 className="text-sm font-black text-navy mb-3">月別推移（今年 / 昨年比較）</h2>
        <MonthlyLineChart data={graphData} />
      </Card>

      {/* クイックアクセス */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <LinkButton href="/visits/new" variant="navy">来店登録</LinkButton>
        <LinkButton href="/search" variant="gold">顧客検索</LinkButton>
        <LinkButton href="/reservations" variant="navy">予約</LinkButton>
        <LinkButton href="/customers" variant="navy">顧客一覧</LinkButton>
        <LinkButton href="/bottles" variant="gold">ボトル</LinkButton>
      </div>
    </AppShell>
  );
}
