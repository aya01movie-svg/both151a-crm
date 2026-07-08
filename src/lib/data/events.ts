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
): Map<string, { title: string; emoji: string; event_type: string; id: string; url?: string | null }[]> {
  const result = new Map<string, { title: string; emoji: string; event_type: string; id: string; url?: string | null }[]>();

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
