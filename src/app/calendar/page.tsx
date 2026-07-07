import Image from "next/image";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { listStoreEvents, listClosedDays, listHolidays, buildNoticeItems } from "@/lib/data/events";
import { getDashboardData } from "@/lib/data/dashboard";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";
import { toJstDateString } from "@/lib/date";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const WEEKDAY_JA = ["日", "月", "火", "水", "木", "金", "土"];

function birthdayLabel(birthday: string): string {
  const bm = Number(birthday.slice(5, 7));
  const bd = Number(birthday.slice(8, 10));
  const now = new Date();
  const yr =
    bm < now.getMonth() + 1 || (bm === now.getMonth() + 1 && bd < now.getDate())
      ? now.getFullYear() + 1
      : now.getFullYear();
  const d = new Date(yr, bm - 1, bd);
  return `${bm}/${bd}(${WEEKDAY_JA[d.getDay()]})`;
}

export default async function NoticePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const now      = new Date();
  const todayJst = toJstDateString(now.toISOString());

  // 当日〜30日先まで取得
  const cdFrom = new Date(now);
  const cdTo   = new Date(now);
  cdTo.setDate(cdTo.getDate() + 30);

  const [events, closedDays, holidays, data] = await Promise.all([
    listStoreEvents(),
    listClosedDays(cdFrom.toISOString().slice(0, 10), cdTo.toISOString().slice(0, 10)),
    listHolidays(cdFrom.toISOString().slice(0, 10), cdTo.toISOString().slice(0, 10)),
    getDashboardData(),
  ]);

  const noticeItems = buildNoticeItems({ todayStr: todayJst, events, closedDays, holidays });

  const hasContent =
    data.todayReservations.length > 0 ||
    data.upcomingBirthdays.length > 0 ||
    noticeItems.length > 0;

  return (
    <AppShell title="お知らせ" staffName={profile.display_name} role={profile.role}>

      {/* MATTY ヘッダー */}
      <div className="flex items-center gap-4 mb-6">
        <Image
          src="/icons/matty-transparent-96.png"
          alt="MATTY"
          width={64}
          height={64}
          className="shrink-0"
        />
        <div>
          <h1 className="text-xl font-black text-navy">MATTYからお知らせ</h1>
          <p className="text-sm text-navy/50 mt-0.5">本日以降の予定・誕生日・イベント</p>
        </div>
      </div>

      {!hasContent && (
        <Card>
          <p className="text-navy/40 text-base py-4 text-center">
            現在お知らせはありません
          </p>
        </Card>
      )}

      {/* 本日の予約 */}
      {data.todayReservations.length > 0 && (
        <Card className="mb-4">
          <h2 className="text-sm font-black text-navy mb-3">📅 本日の予約</h2>
          <ul className="flex flex-col gap-3">
            {data.todayReservations.map((r) => (
              <li key={r.id} className="flex items-center justify-between rounded-app bg-[#e8f4ff] px-4 py-3">
                <div>
                  <p className="font-black text-navy text-lg">{r.customerName}様</p>
                  <p className="text-sm text-navy/60 mt-0.5">{r.time}　{r.peopleCount}名</p>
                </div>
                <span className="text-2xl">📢</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* 誕生日（直近7日・当日含む） */}
      {data.upcomingBirthdays.length > 0 && (
        <Card className="mb-4">
          <h2 className="text-sm font-black text-[#7a4fa3] mb-3">🎂 誕生日が近いお客様</h2>
          <ul className="flex flex-col gap-3">
            {data.upcomingBirthdays.map((c) => (
              <li key={c.id} className="flex items-center justify-between rounded-app bg-[#fce8f3] px-4 py-3">
                <div>
                  <p className="font-black text-navy text-lg">{c.display_name}様</p>
                  <p className="text-sm text-navy/60 mt-0.5">
                    {birthdayLabel(c.birthday)}　
                    {c.daysUntil === 0 ? "🎉 本日！" : `あと${c.daysUntil}日`}
                  </p>
                </div>
                <span className="text-2xl">🎂</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* イベント・店休日・祝日（当日以降） */}
      {noticeItems.length > 0 && (
        <Card>
          <h2 className="text-sm font-black text-navy mb-3">📌 今後の予定</h2>
          <ul className="flex flex-col gap-3">
            {noticeItems.map((item) => (
              <li key={item.key} className={`flex items-start gap-3 px-4 py-3 rounded-app ${item.colorClass}`}>
                <span className="text-2xl leading-none shrink-0">{item.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-black text-navy text-base">{item.title}</p>
                  <p className="text-sm text-navy/60 mt-0.5">{item.subtitle}</p>
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-info underline mt-1 inline-block"
                    >
                      🔗 詳細を見る
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

    </AppShell>
  );
}
