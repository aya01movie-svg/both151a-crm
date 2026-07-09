import Link from "next/link";
import { getDashboardData, getYearlyMonthlyAmounts } from "@/lib/data/dashboard";
import { getMonthSummary } from "@/lib/data/calendar";
import { listCustomers } from "@/lib/data/customers";
import { Card } from "@/components/ui/Card";
import { CalendarClient } from "@/components/calendar/CalendarClient";
import { toJstDateString, yen } from "@/lib/date";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = Promise<{ q?: string; year?: string; month?: string }>;

// HOME検索窓にこの文字列を入力したときだけ、月別売上の内訳を表示する。
const MONTHLY_SALES_QUERY = "月別売上";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params   = await searchParams;
  const now      = new Date();
  const todayJst = toJstDateString(now.toISOString());
  const [dy, dm] = todayJst.split("-").map(Number);

  const year  = Number(params.year)  || dy;
  const month = Number(params.month) || dm;

  // 検索クエリ
  const q = params.q?.trim() ?? "";
  const isMonthlySalesQuery = q === MONTHLY_SALES_QUERY;

  const [data, calData, searchResult, monthlySales] = await Promise.all([
    getDashboardData(),
    getMonthSummary(year, month),
    q && !isMonthlySalesQuery ? listCustomers({ search: q, page: 0 }) : Promise.resolve(null),
    isMonthlySalesQuery ? getYearlyMonthlyAmounts(year) : Promise.resolve(null),
  ]);

  const yearTotal = monthlySales ? monthlySales.reduce((sum, m) => sum + m.amount, 0) : 0;

  return (
    <>
      {/* 日付表示はヘッダー（TOPバナー直下）の1箇所のみとし、ここでは表示しない */}

      {/* ── KPI（今月のみ） ── */}
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
      {q && !isMonthlySalesQuery && searchResult && (
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

      {/* ── 月別売上（検索窓に「月別売上」と入力したときだけ表示） ──────
          カレンダーで表示中の年（year）を対象に1〜12月の内訳＋年合計を表示する。
          通常時は非表示（見えすぎ防止のため、v1.2でカレンダー常設フッターから
          この検索トリガー方式に変更）。 */}
      {isMonthlySalesQuery && monthlySales && (
        <Card className="mb-4">
          <p className="text-xs font-black text-navy/50 mb-3">{year}年 月別売上</p>
          <ul className="flex flex-col gap-1.5 mb-3">
            {monthlySales.map((m) => (
              <li key={m.month}
                  className="flex items-center justify-between rounded-app bg-navy/5 px-4 py-2.5">
                <p className="text-sm font-bold text-navy/60">{m.month}月</p>
                <p className="text-base font-black text-navy">{yen(m.amount)}</p>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between rounded-app bg-gold/15 border-2 border-gold/40 px-4 py-3">
            <p className="text-sm font-black text-navy">{year}年 年合計</p>
            <p className="text-xl font-black text-navy">{yen(yearTotal)}</p>
          </div>
        </Card>
      )}
    </>
  );
}