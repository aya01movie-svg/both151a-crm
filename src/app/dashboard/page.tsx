import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { getDashboardData } from "@/lib/data/dashboard";
import { getMonthSummary } from "@/lib/data/calendar";
import { listCustomers } from "@/lib/data/customers";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";
import { CalendarClient } from "@/components/calendar/CalendarClient";
import { toJstDateString, yen } from "@/lib/date";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const WEEKDAY_JA = ["日", "月", "火", "水", "木", "金", "土"];

type SearchParams = Promise<{ q?: string; year?: string; month?: string }>;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const params   = await searchParams;
  const now      = new Date();
  const todayJst = toJstDateString(now.toISOString());
  const [dy, dm, dd] = todayJst.split("-").map(Number);
  const dow = WEEKDAY_JA[new Date(dy, dm-1, dd).getDay()];
  const dateLabel = `${dy}年${dm}月${dd}日（${dow}）`;

  const year  = Number(params.year)  || dy;
  const month = Number(params.month) || dm;

  // 検索クエリ
  const q = params.q?.trim() ?? "";

  const [data, calData, searchResult] = await Promise.all([
    getDashboardData(),
    getMonthSummary(year, month),
    q ? listCustomers({ search: q, page: 0 }) : Promise.resolve(null),
  ]);

  const todayVisits       = calData.days[todayJst]?.visits       ?? [];
  const todayReservations = calData.days[todayJst]?.reservations ?? [];

  // 今日の合計売上（来店済み分）
  const todayTotal = todayVisits.reduce((sum, v) => sum + v.amount, 0);

  return (
    <AppShell title="ホーム" staffName={profile.display_name} role={profile.role}>

      {/* ── 日付（上部1つだけ） ────────────── */}
      <p className="text-center text-base font-bold text-navy/60 mb-4">{dateLabel}</p>

      {/* ── KPI（売上今日を除外、今月のみ） ── */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Card className="text-center py-3">
          <p className="text-xs text-navy/50 font-bold mb-1">今月売上</p>
          <p className="text-2xl font-black text-navy truncate">{yen(data.monthAmount)}</p>
          <p className="text-xs text-navy/40 mt-0.5">{data.monthVisitCount}組</p>
        </Card>
        <Card className="text-center py-3">
          <p className="text-xs text-navy/50 font-bold mb-1">今月チップ</p>
          <p className="text-2xl font-black text-navy truncate">{yen(data.monthTip)}</p>
          <p className="text-xs text-navy/40 mt-0.5">月合計</p>
        </Card>
      </div>

      {/* ── 検索窓（インライン結果） ─────── */}
      <form method="get" action="/dashboard" className="mb-4">
        {/* year/monthを維持 */}
        {params.year  && <input type="hidden" name="year"  value={params.year} />}
        {params.month && <input type="hidden" name="month" value={params.month} />}
        <div className="flex gap-2">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="名前・タグ・メモ・ボトル名で検索…"
            className="flex-1 min-h-14 rounded-app border-2 border-navy/10 bg-white px-5
                       text-base text-navy placeholder:text-navy/30
                       focus:outline-none focus:border-gold transition-colors"
            autoComplete="off"
          />
          <button type="submit"
            className="min-h-14 px-5 rounded-app bg-gold text-navy font-black text-lg">
            🔍
          </button>
          {q && (
            <a href="/dashboard"
               className="min-h-14 px-4 rounded-app bg-white border-2 border-navy/10 text-navy/50 font-bold text-sm flex items-center">
              ✕
            </a>
          )}
        </div>
      </form>

      {/* ── 検索結果（インライン） ──────── */}
      {q && searchResult && (
        <Card className="mb-4">
          <p className="text-xs font-black text-navy/50 mb-3">
            「{q}」の検索結果 {searchResult.customers.length}件
          </p>
          {searchResult.customers.length === 0 ? (
            <p className="text-navy/40 text-base">見つかりませんでした。</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {searchResult.customers.map((c) => (
                <li key={c.id}>
                  <Link href={`/customers/${c.id}`}
                        className="flex items-center justify-between rounded-app
                                   border border-navy/10 bg-white px-4 py-3 hover:bg-gold/5">
                    <div>
                      <p className="font-black text-navy text-base">{c.display_name}</p>
                      {c.kana && <p className="text-xs text-navy/40">{c.kana}</p>}
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <p className="text-xs font-bold text-navy/50">来店 {c.visit_count}回</p>
                      {(c.current_bottle_count ?? 0) > 0 && (
                        <p className="text-xs text-warn">🍷 {c.current_bottle_count}本</p>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {/* ── カレンダー ─────────────────────── */}
      <div className="mb-4">
        <CalendarClient data={calData} />
      </div>

      {/* ── 来店・予約一覧 ─────────────────── */}
      <Card>
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-black text-navy">本日の記録</h2>
          <span className="text-sm text-navy/40">
            来店{todayVisits.length} / 予約{todayReservations.length}
          </span>
        </div>

        {todayVisits.length === 0 && todayReservations.length === 0 && (
          <p className="text-navy/40 text-base py-2">まだ来店・予約はありません。</p>
        )}

        {/* 予約 */}
        {todayReservations.length > 0 && (
          <div className="mb-4">
            <p className="text-sm font-black text-info mb-2">予約</p>
            <ul className="flex flex-col gap-2">
              {todayReservations.map((r) => (
                <li key={r.id}
                    className="rounded-app border border-info/20 bg-info/5 px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-black text-navy text-xl">{r.customerName}</p>
                    <span className="text-sm font-black text-info bg-info/10 px-2 py-1 rounded-full shrink-0">
                      予約中
                    </span>
                  </div>
                  <p className="text-base font-bold text-navy/60 mt-1">
                    {r.time}
                    {r.companionNames.length > 0 && (
                      <span className="ml-2">同伴：{r.companionNames.join("、")}</span>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 来店済み */}
        {todayVisits.length > 0 && (
          <div>
            <p className="text-sm font-black text-success mb-2">来店済み</p>
            <ul className="flex flex-col gap-2">
              {todayVisits.map((v) => (
                <li key={v.id}
                    className="rounded-app border border-success/10 bg-success/5 px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-black text-navy text-xl truncate">
                      {v.hasChampagne && <span className="mr-1">🍾</span>}
                      {v.customerName}
                    </p>
                    <p className="text-xl font-black text-navy shrink-0 ml-2">{yen(v.amount)}</p>
                  </div>
                  {v.companionNames.length > 0 && (
                    <p className="text-base font-bold text-navy/60 mt-1">
                      同伴：{v.companionNames.join("、")}
                    </p>
                  )}
                </li>
              ))}
            </ul>

            {/* 合計 */}
            <div className="mt-3 flex justify-end border-t border-navy/10 pt-3">
              <p className="text-base font-black text-navy">
                売上合計　{yen(todayTotal)}
              </p>
            </div>
          </div>
        )}
      </Card>

    </AppShell>
  );
}
