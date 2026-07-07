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

/** 店休日一覧（from〜to 区間） */
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

/** 祝日（from〜to 区間） */
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

  function push(dateStr: string, entry: { title: string; emoji: string; event_type: string; id: string; url?: string | null }) {
    const list = result.get(dateStr) ?? [];
    list.push(entry);
    result.set(dateStr, list);
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  const pad = (n: number) => String(n).padStart(2, "0");

  for (const ev of events) {
    const entry = { title: ev.title, emoji: ev.emoji, event_type: ev.event_type, id: ev.id, url: ev.url };

    if (ev.schedule_type === "weekly" && ev.weekly_day !== null) {
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

export type NoticeItem = {
  key: string;
  emoji: string;
  title: string;
  subtitle: string;
  colorClass: string;
  url?: string | null;
};

/**
 * ホームの「MATTYからお知らせ」用。
 * 本日〜7日先までのイベント・店休日・祝日を抽出して表示用データを返す。
 */
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

  // 店休日 (当日〜7日先)
  for (const cd of closedDays) {
    const diff = dayDiff(cd.date);
    if (diff < 0 || diff > 7) continue;
    const subtitle = diff === 0 ? "本日休業" : `${dateLabel(cd.date)}`;
    items.push({ key: `closed-${cd.date}`, emoji: "🎌", title: cd.note || "店休日", subtitle, colorClass: "bg-[#fde8e8]" });
  }

  // 祝日 (当日〜7日先)
  for (const h of holidays) {
    const diff = dayDiff(h.date);
    if (diff < 0 || diff > 7) continue;
    const subtitle = diff === 0 ? "本日" : dateLabel(h.date);
    items.push({ key: `holiday-${h.date}`, emoji: "㊗️", title: h.name, subtitle, colorClass: "bg-[#fde8e8]" });
  }

  // イベント (当日〜7日先)
  for (const ev of events) {
    const pushEvent = (diff: number, dateStr: string) => {
      if (diff >= 0 && diff <= 7) {
        const subtitle = diff === 0 ? "本日" : dateLabel(dateStr);
        items.push({
          key: `ev-${ev.id}-${dateStr}`,
          emoji: ev.title.includes("🚫") ? "" : (ev.emoji || "📅"),
          title: ev.title,
          subtitle,
          colorClass: "bg-[#fef3e2]",
          url: ev.url 
        });
      }
    };

    if (ev.schedule_type === "weekly" && ev.weekly_day !== null) {
      for (let i = 0; i <= 7; i++) {
        const d = new Date(today.getTime() + i * 86400000);
        if (d.getDay() === ev.weekly_day) {
          const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
          pushEvent(i, dateStr);
          break;
        }
      }
    } else if (ev.schedule_type === "annual" && ev.annual_month && ev.annual_day) {
      const thisYear = today.getFullYear();
      for (const yr of [thisYear, thisYear + 1]) {
        const dateStr = `${yr}-${pad(ev.annual_month)}-${pad(ev.annual_day)}`;
        const diff = dayDiff(dateStr);
        if (diff >= 0 && diff <= 7) {
          pushEvent(diff, dateStr);
          break;
        }
      }
    } else if (ev.schedule_type === "single" && ev.start_date) {
      const diff = dayDiff(ev.start_date);
      if (diff >= 0 && diff <= 7) {
        pushEvent(diff, ev.start_date);
      }
    } else if (ev.schedule_type === "range" && ev.start_date && ev.end_date) {
      const diffStart = dayDiff(ev.start_date);
      const diffEnd   = dayDiff(ev.end_date);
      if (diffEnd >= 0 && diffStart <= 7) {
        const subtitle = diffStart <= 0 ? "開催中" : `${dateLabel(ev.start_date)} から`;
        items.push({
          key: `ev-${ev.id}`,
          emoji: ev.title.includes("🚫") ? "" : (ev.emoji || "📅"),
          title: ev.title,
          subtitle,
          colorClass: "bg-[#e8ffe8]",
          url: ev.url
        });
      }
    }
  }

  return items.slice(0, 20);
}