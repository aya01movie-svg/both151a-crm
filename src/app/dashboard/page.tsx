import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { getDashboardData } from "@/lib/data/dashboard";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardTitle } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { daysSince } from "@/lib/date";

function yen(n: number) {
  return `¥${n.toLocaleString("ja-JP")}`;
}

export default async function DashboardPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const data = await getDashboardData();

  const kpis = [
    {
      label: "今日売上",
      value: yen(data.todayAmount),
      sub: `${data.todayVisitCount}組 / ${data.todayPeopleCount}名`,
    },
    { label: "今日チップ", value: yen(data.todayTip), sub: "別集計" },
    {
      label: "今月売上",
      value: yen(data.monthAmount),
      sub: `${data.monthVisitCount}組`,
    },
    { label: "今月チップ", value: yen(data.monthTip), sub: "月合計" },
    {
      label: "本日の予約件数",
      value: `${data.todayReservationCount}件`,
      sub: "予約管理より",
    },
  ];

  const hasNotice =
    data.bottlesExpired > 0 ||
    data.bottlesWithin7 > 0 ||
    data.bottlesWithin14 > 0 ||
    data.bottlesWithin30 > 0 ||
    data.tomorrowBirthdays.length > 0 ||
    data.todayBirthdays.length > 0;

  return (
    <AppShell title="ホーム / ダッシュボード" staffName={profile.display_name} role={profile.role}>
      <p className="text-navy/50 text-sm mb-4">
        営業中に必要な情報を1画面で確認
      </p>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {kpis.map((k) => (
          <Card key={k.label} className="text-center">
            <p className="text-navy/50 text-xs font-bold mb-1">{k.label}</p>
            <p className="text-navy text-xl font-black">{k.value}</p>
            <p className="text-navy/40 text-[11px] mt-0.5">{k.sub}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* 通知 */}
        <Card>
          <CardTitle>通知</CardTitle>
          {!hasNotice && (
            <p className="text-navy/40 text-sm">現在、通知はありません。</p>
          )}
          <ul className="space-y-2 text-sm">
            {data.bottlesExpired > 0 && (
              <li className="font-bold text-navy-dark">
                ⚫期限切れボトル {data.bottlesExpired}本
              </li>
            )}
            {data.bottlesWithin7 > 0 && (
              <li className="font-bold text-danger">
                🔴7日以内ボトル {data.bottlesWithin7}本
              </li>
            )}
            {data.bottlesWithin14 > 0 && (
              <li className="font-bold text-[#b58a05]">
                🟡14日以内ボトル {data.bottlesWithin14}本
              </li>
            )}
            {data.bottlesWithin30 > 0 && (
              <li className="font-bold text-warn">
                🟠30日以内ボトル {data.bottlesWithin30}本
              </li>
            )}
            {data.todayBirthdays.length > 0 && (
              <li className="font-bold text-[#7a4fa3]">
                🎉本日誕生日 {data.todayBirthdays.length}名（
                {data.todayBirthdays.map((c) => c.display_name).join("・")}
                ）
              </li>
            )}
            {data.tomorrowBirthdays.length > 0 && (
              <li className="font-bold text-info">
                明日誕生日 {data.tomorrowBirthdays.length}名（
                {data.tomorrowBirthdays.map((c) => c.display_name).join("・")}
                ）
              </li>
            )}
          </ul>
        </Card>

        {/* 最近見た顧客 */}
        <Card>
          <CardTitle>最近見た顧客</CardTitle>
          {data.recentlyViewed.length === 0 && (
            <p className="text-navy/40 text-sm">まだ閲覧履歴がありません。</p>
          )}
          <ul className="space-y-2 text-sm">
            {data.recentlyViewed.slice(0, 6).map((c) => (
              <li key={c.id}>
                <a href={`/customers/${c.id}`} className="font-bold text-navy hover:underline">
                  {c.display_name}
                </a>
                <span className="text-navy/40 ml-2">
                  {c.last_visit_at
                    ? `最終${daysSince(c.last_visit_at)}日前`
                    : "来店履歴なし"}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        {/* 最近よく来るお客様 */}
        <Card>
          <CardTitle>最近よく来るお客様</CardTitle>
          {data.frequentVisitors.length === 0 && (
            <p className="text-navy/40 text-sm">
              直近3か月の来店データがまだありません。
            </p>
          )}
          <ol className="space-y-2 text-sm list-decimal list-inside">
            {data.frequentVisitors.map((c) => (
              <li key={c.id}>
                <a href={`/customers/${c.id}`} className="font-bold text-navy hover:underline">
                  {c.display_name}
                </a>
                <span className="text-navy/40 ml-2">{c.visitCount}回来店</span>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      {data.vipNeedingFollowUp.length > 0 && (
        <Card className="mb-6 border-l-4 border-warn">
          <CardTitle>来店ペースを超えて来店していないVIP・お気に入り</CardTitle>
          <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            {data.vipNeedingFollowUp.map((c) => (
              <li key={c.id}>
                <a href={`/customers/${c.id}`} className="font-bold text-navy hover:underline">
                  {c.display_name}
                </a>
                <span className="text-navy/40 ml-2">
                  {c.last_visit_at ? `${daysSince(c.last_visit_at)}日来店なし` : "来店履歴なし"}
                  （通常ペース：{c.paceLabel}）
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

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
