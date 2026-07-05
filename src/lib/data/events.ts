import { createClient } from "@/lib/supabase/server";
import type { StoreEventRow, ClosedDayRow, HolidayRow } from "@/types/database";

export type StoreEvent = Omit<StoreEventRow, "created_by" | "updated_at"> & {
  schedule_type: "single" | "range" | "weekly" | "annual";
};
export type ClosedDay = Pick<ClosedDayRow, "id" | "date" | "note">;
export type Holiday = Pick<HolidayRow, "date" | "name">;

/** 全アクティブイベントを取得 */
export async function listStoreEvents(): Promise<StoreEvent[]> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("store_events")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  return (data ?? []) as StoreEvent[];
}

/** 店休日一覧（from〜to 範囲） */
export async function listClosedDays(from: string, to: string): Promise<ClosedDay[]> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("closed_days")
    .select("id, date, note")
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: true });
  return (data ?? []) as ClosedDay[];
}

/** 祝日（from〜to 範囲） */
export async function listHolidays(from: string, to: string): Promise<Holiday[]> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("holidays")
    .select("date, name")
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: true });
  return (data ?? []) as Holiday[];
}

/**
 * 指定月のイベント表示データを計算する。
 * weekly / annual / single / range それぞれについて、
 * 指定月のどの日付に表示すべきかを返す。
 */
export function resolveEventDatesForMonth(
  events: StoreEvent[],
  year: number,
  month: number
): Map<string, { title: string; emoji: string; event_type: string; id: string }[]> {
  const result = new Map<string, { title: string; emoji: string; event_type: string; id: string }[]>();

  function push(dateStr: string, entry: { title: string; emoji: string; event_type: string; id: string }) {
    const list = result.get(dateStr) ?? [];
    list.push(entry);
    result.set(dateStr, list);
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  const pad = (n: number) => String(n).padStart(2, "0");

  for (const ev of events) {
    const entry = { title: ev.title, emoji: ev.emoji, event_type: ev.event_type, id: ev.id };

    if (ev.schedule_type === "weekly" && ev.weekly_day !== null) {
      // 今月の指定曜日をすべて列挙
      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month - 1, d);
        if (date.getDay() === ev.weekly_day) {
          push(`${year}-${pad(month)}-${pad(d)}`, entry);
        }
      }
    } else if (ev.schedule_type === "annual" && ev.annual_month && ev.annual_day) {
      if (ev.annual_month === month) {
        push(`${year}-${pad(month)}-${pad(ev.annual_day)}`, entry);
      }
    } else if (ev.schedule_type === "single" && ev.start_date) {
      const d = ev.start_date.slice(0, 7) === `${year}-${pad(month)}` ? ev.start_date : null;
      if (d) push(d, entry);
    } else if (ev.schedule_type === "range" && ev.start_date && ev.end_date) {
      const rangeStart = ev.start_date;
      const rangeEnd = ev.end_date;
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${pad(month)}-${pad(d)}`;
        if (dateStr >= rangeStart && dateStr <= rangeEnd) {
          push(dateStr, entry);
        }
      }
    }
  }

  return result;
}

/**
 * ホームの「MATTYからお知らせ」用：
 * 今日〜14日先のイベント・店休日・祝日を収集して表示用データを返す。
 */
export type NoticeItem = {
  key: string;
  emoji: string;
  title: string;
  subtitle: string;
  colorClass: string;
};

export function buildNoticeItems(params: {
  todayStr: string;
  events: StoreEvent[];
  closedDays: ClosedDay[];
  holidays: Holiday[];
}): NoticeItem[] {
  const { todayStr, events, closedDays, holidays } = params;
  const today = new Date(todayStr);
  const items: NoticeItem[] = [];

  const pad = (n: number) => String(n).padStart(2, "0");
  const WEEKDAY_JA = ["日", "月", "火", "水", "木", "金", "土"];

  function dateLabel(dateStr: string): string {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAY_JA[d.getDay()]})`;
  }

  function dayDiff(dateStr: string): number {
    const d = new Date(dateStr);
    return Math.round((d.getTime() - today.getTime()) / 86400000);
  }

  // 店休日（14日先まで）
  for (const cd of closedDays) {
    const diff = dayDiff(cd.date);
    if (diff < 0 || diff > 14) continue;
    const subtitle = diff === 0 ? "本日休業" : diff === 1 ? "明日休業" : `${dateLabel(cd.date)} 休業`;
    items.push({ key: `closed-${cd.date}`, emoji: "🚫", title: cd.note || "店休日", subtitle, colorClass: "bg-[#fde8e8]" });
  }

  // 祝日（14日先まで）
  for (const h of holidays) {
    const diff = dayDiff(h.date);
    if (diff < 0 || diff > 14) continue;
    const subtitle = diff === 0 ? "本日" : diff === 1 ? "明日" : dateLabel(h.date);
    items.push({ key: `holiday-${h.date}`, emoji: "🔴", title: h.name, subtitle, colorClass: "bg-[#fde8e8]" });
  }

  // イベント
  for (const ev of events) {
    if (ev.schedule_type === "weekly" && ev.weekly_day !== null) {
      // 今日〜14日先の中で最初の発生日を1件表示
      for (let i = 0; i <= 14; i++) {
        const d = new Date(today.getTime() + i * 86400000);
        if (d.getDay() === ev.weekly_day) {
          const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
          const subtitle = i === 0 ? "本日開催" : i === 1 ? "明日開催" : `毎週${WEEKDAY_JA[ev.weekly_day]} / 次回 ${dateLabel(dateStr)}`;
          items.push({ key: `ev-${ev.id}-${dateStr}`, emoji: ev.emoji, title: ev.title, subtitle, colorClass: "bg-[#e8f4ff]" });
          break;
        }
      }
    } else if (ev.schedule_type === "annual" && ev.annual_month && ev.annual_day) {
      const thisYear = today.getFullYear();
      for (const yr of [thisYear, thisYear + 1]) {
        const dateStr = `${yr}-${pad(ev.annual_month)}-${pad(ev.annual_day)}`;
        const diff = dayDiff(dateStr);
        if (diff >= 0 && diff <= 30) {
          const subtitle = diff === 0 ? "本日" : `あと${diff}日 (${dateLabel(dateStr)})`;
          items.push({ key: `ev-${ev.id}`, emoji: ev.emoji, title: ev.title, subtitle, colorClass: "bg-[#fef3e2]" });
          break;
        }
      }
    } else if (ev.schedule_type === "single" && ev.start_date) {
      const diff = dayDiff(ev.start_date);
      if (diff >= -1 && diff <= 14) {
        const subtitle = diff < 0 ? "昨日" : diff === 0 ? "本日" : `あと${diff}日 (${dateLabel(ev.start_date)})`;
        items.push({ key: `ev-${ev.id}`, emoji: ev.emoji, title: ev.title, subtitle, colorClass: "bg-[#fef3e2]" });
      }
    } else if (ev.schedule_type === "range" && ev.start_date && ev.end_date) {
      const diffStart = dayDiff(ev.start_date);
      const diffEnd = dayDiff(ev.end_date);
      if (diffEnd < 0) continue; // 終了済み
      if (diffStart <= 14) {
        const subtitle =
          diffStart > 0 ? `あと${diffStart}日から (〜${dateLabel(ev.end_date)})`
          : diffEnd === 0 ? "本日最終日"
          : "開催中";
        items.push({ key: `ev-${ev.id}`, emoji: ev.emoji, title: ev.title, subtitle, colorClass: "bg-[#e8ffe8]" });
      }
    }
  }

  // 日付が近い順にソート
  return items.slice(0, 12); // 最大12件
}
