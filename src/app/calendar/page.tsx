import Image from "next/image";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { listStoreEvents, listClosedDays, listHolidays } from "@/lib/data/events";
import { getDashboardData } from "@/lib/data/dashboard";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";
import { toJstDateString } from "@/lib/date";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const WEEKDAY_JA = ["日", "月", "火", "水", "木", "金", "土"];

function dateLabel(dateStr: string): string {
  const [y,m,d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m-1, d);
  return `${m}/${d}(${WEEKDAY_JA[dt.getDay()]})`;
}

function birthdayLabel(birthday: string): string {
  const bm = Number(birthday.slice(5, 7));
  const bd = Number(birthday.slice(8, 10));
  const now = new Date();
  const yr = bm < now.getMonth()+1 || (bm===now.getMonth()+1 && bd < now.getDate())
    ? now.getFullYear()+1 : now.getFullYear();
  const d = new Date(yr, bm-1, bd);
  return `${bm}/${bd}(${WEEKDAY_JA[d.getDay()]})`;
}

function pad(n: number) { return String(n).padStart(2,"0"); }

export default async function NoticePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const now      = new Date();
  const todayJst = toJstDateString(now.toISOString());
  const cdTo     = new Date(now); cdTo.setDate(cdTo.getDate() + 30);

  const [events, closedDays, holidays, data] = await Promise.all([
    listStoreEvents(),
    listClosedDays(todayJst, cdTo.toISOString().slice(0, 10)),
    listHolidays(todayJst,   cdTo.toISOString().slice(0, 10)),
    getDashboardData(),
  ]);

  const today = new Date(todayJst);
  // 曜日計算修正: today は "YYYY-MM-DD" をUTC午前0時として解釈したDateのため、
  // サーバーのローカルタイムゾーン設定に左右されないよう getUTCDay() を使う
  // （getDay() だとサーバーがUTC以外で動く場合に曜日が1日ズレることがあった）。
  const todayDow = today.getUTCDay();
  function dayDiff(dateStr: string): number {
    return Math.round((new Date(dateStr).getTime() - today.getTime()) / 86400000);
  }

  // ── 店休日・祝日（当日から）────────────────
  type NoticeRow = { key: string; emoji: string; title: string; subtitle: string; url?: string | null; bg: string };
  const rows: NoticeRow[] = [];

  for (const cd of closedDays) {
    const diff = dayDiff(cd.date);
    if (diff < 0 || diff > 30) continue;
    const sub = diff===0 ? "本日休業" : diff===1 ? "明日休業" : `${dateLabel(cd.date)} 休業`;
    rows.push({ key:`cd-${cd.date}`, emoji:"🚫", title: cd.note||"店休日", subtitle: sub, bg:"bg-[#fde8e8]" });
  }

  for (const h of holidays) {
    const diff = dayDiff(h.date);
    if (diff < 0 || diff > 30) continue;
    const sub = diff===0 ? "本日" : diff===1 ? "明日" : dateLabel(h.date);
    rows.push({ key:`hol-${h.date}`, emoji:"🔴", title: h.name+"（祝日）", subtitle: sub, bg:"bg-[#fde8e8]" });
  }

  // ── スタッフ欠席イベント（当日から）────────
  for (const ev of events) {
    if (ev.event_type !== "staff") continue;
    if (ev.schedule_type === "single" && ev.start_date) {
      const diff = dayDiff(ev.start_date);
      if (diff < 0 || diff > 30) continue;
      const sub = diff===0 ? "本日" : diff===1 ? "明日" : dateLabel(ev.start_date);
      rows.push({ key:`ev-${ev.id}`, emoji: ev.emoji, title: ev.title, subtitle: sub, url: ev.url, bg:"bg-[#f5f0ff]" });
    } else if (ev.schedule_type === "range" && ev.start_date && ev.end_date) {
      const diffEnd = dayDiff(ev.end_date);
      if (diffEnd < 0) continue;
      const diffStart = dayDiff(ev.start_date);
      if (diffStart > 30) continue;
      const sub = diffStart===0 ? `〜${dateLabel(ev.end_date)}` : diffStart>0 ? `${dateLabel(ev.start_date)}〜${dateLabel(ev.end_date)}` : `〜${dateLabel(ev.end_date)}`;
      rows.push({ key:`ev-${ev.id}`, emoji: ev.emoji, title: ev.title, subtitle: sub, url: ev.url, bg:"bg-[#f5f0ff]" });
    } else if (ev.schedule_type === "weekly" && ev.weekly_day !== null) {
      for (let i=0; i<=30; i++) {
        const d = new Date(today.getTime()+i*86400000);
        if (d.getUTCDay()===ev.weekly_day) {
          const ds=`${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`;
          const sub = i===0?"本日":i===1?"明日":`毎週${WEEKDAY_JA[ev.weekly_day]} / 次回${dateLabel(ds)}`;
          rows.push({ key:`ev-${ev.id}-${ds}`, emoji: ev.emoji, title: ev.title, subtitle: sub, url: ev.url, bg:"bg-[#f5f0ff]" });
          break;
        }
      }
    }
  }

  // ── 店イベント（当日のみ表示）────────────
  for (const ev of events) {
    if (ev.event_type === "staff") continue;
    if (ev.schedule_type === "single" && ev.start_date) {
      if (dayDiff(ev.start_date) !== 0) continue;
    } else if (ev.schedule_type === "range" && ev.start_date && ev.end_date) {
      if (dayDiff(ev.start_date) > 0 || dayDiff(ev.end_date) < 0) continue;
    } else if (ev.schedule_type === "annual" && ev.annual_month && ev.annual_day) {
      const ds = `${now.getFullYear()}-${pad(ev.annual_month)}-${pad(ev.annual_day)}`;
      if (dayDiff(ds) !== 0) continue;
    } else if (ev.schedule_type === "weekly" && ev.weekly_day !== null) {
      if (todayDow !== ev.weekly_day) continue;
    } else continue;
    rows.push({ key:`store-${ev.id}`, emoji: ev.emoji, title: ev.title, subtitle:"本日", url: ev.url, bg:"bg-[#e8f4ff]" });
  }

  // ── 入力イベント（週から表示 = 7日以内）────
  for (const ev of events) {
    if (ev.event_type === "staff") continue;
    // 既に上のループで当日追加済みは skip
    if (rows.find(r=>r.key===`store-${ev.id}`)) continue;
    if (ev.schedule_type === "single" && ev.start_date) {
      const diff = dayDiff(ev.start_date);
      if (diff <= 0 || diff > 7) continue;
      rows.push({ key:`week-${ev.id}`, emoji: ev.emoji, title: ev.title, subtitle: dateLabel(ev.start_date), url: ev.url, bg:"bg-[#fffde8]" });
    } else if (ev.schedule_type === "range" && ev.start_date && ev.end_date) {
      const diffStart = dayDiff(ev.start_date);
      const diffEnd   = dayDiff(ev.end_date);
      if (diffEnd < 0 || diffStart > 7) continue;
      if (diffStart <= 0) continue; // 当日はstore済み
      rows.push({ key:`week-${ev.id}`, emoji: ev.emoji, title: ev.title, subtitle:`${dateLabel(ev.start_date)}〜${dateLabel(ev.end_date)}`, url: ev.url, bg:"bg-[#fffde8]" });
    }
  }

  const hasContent = data.todayReservations.length>0 || data.upcomingBirthdays.length>0 || rows.length>0;

  return (
    <AppShell title="お知らせ" staffName={profile.display_name} role={profile.role}>

      <div className="flex items-center gap-4 mb-6">
        <Image src="/icons/matty-transparent-96.png" alt="MATTY" width={60} height={60} className="shrink-0" />
        <div>
          <h1 className="text-xl font-black text-navy">MATTYからお知らせ</h1>
          <p className="text-sm text-navy/50 mt-0.5">本日の予定・誕生日・休日・イベント</p>
        </div>
      </div>

      {!hasContent && (
        <Card><p className="text-navy/40 text-base py-4 text-center">現在お知らせはありません</p></Card>
      )}

      {/* 本日の予約 */}
      {data.todayReservations.length > 0 && (
        <Card className="mb-4">
          <h2 className="text-sm font-black text-navy mb-3">📢 本日の予約</h2>
          <ul className="flex flex-col gap-3">
            {data.todayReservations.map((r) => (
              <li key={r.id} className="flex items-center justify-between rounded-app bg-[#e8f4ff] px-4 py-3">
                <div>
                  <p className="font-black text-navy text-xl">{r.customerName}様</p>
                  <p className="text-base text-navy/60 mt-0.5">{r.time}　{r.peopleCount}名</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* 誕生日 */}
      {data.upcomingBirthdays.length > 0 && (
        <Card className="mb-4">
          <h2 className="text-sm font-black text-[#7a4fa3] mb-3">🎂 誕生日が近いお客様</h2>
          <ul className="flex flex-col gap-3">
            {data.upcomingBirthdays.map((c) => (
              <li key={c.id} className="flex items-center justify-between rounded-app bg-[#fce8f3] px-4 py-3">
                <div>
                  <p className="font-black text-navy text-xl">{c.display_name}様</p>
                  <p className="text-base text-navy/60 mt-0.5">
                    {birthdayLabel(c.birthday)}{c.daysUntil===0 ? "　🎉 本日！" : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* 店休日・祝日・スタッフ・イベント */}
      {rows.length > 0 && (
        <Card>
          <h2 className="text-sm font-black text-navy mb-3">📌 予定・休日</h2>
          <ul className="flex flex-col gap-3">
            {rows.map((item) => (
              <li key={item.key} className={`flex items-start gap-3 px-4 py-3 rounded-app ${item.bg}`}>
                <span className="text-2xl leading-none shrink-0">{item.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-black text-navy text-base">
                    {item.url
                      ? <a href={item.url} target="_blank" rel="noopener noreferrer" className="underline text-info">{item.title}</a>
                      : item.title}
                  </p>
                  <p className="text-sm text-navy/60 mt-0.5">{item.subtitle}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </AppShell>
  );
}