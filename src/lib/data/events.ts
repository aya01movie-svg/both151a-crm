// 123行目付近 buildNoticeItems 関数を以下に置き換え
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

  for (const cd of closedDays) {
    const diff = dayDiff(cd.date);
    if (diff < 0 || diff > 7) continue;
    const subtitle = diff === 0 ? "本日休業" : `${dateLabel(cd.date)}`;
    items.push({ key: `closed-${cd.date}`, emoji: "🎌", title: cd.note || "店休日", subtitle, colorClass: "bg-[#fde8e8]" });
  }

  for (const h of holidays) {
    const diff = dayDiff(h.date);
    if (diff < 0 || diff > 7) continue;
    const subtitle = diff === 0 ? "本日" : dateLabel(h.date);
    items.push({ key: `holiday-${h.date}`, emoji: "㊗️", title: h.name, subtitle, colorClass: "bg-[#fde8e8]" });
  }

  for (const ev of events) {
    const pushEvent = (diff: number, dateStr: string) => {
      if (diff >= 0 && diff <= 7) {
        const subtitle = diff === 0 ? "本日" : dateLabel(dateStr);
        items.push({ key: `ev-${ev.id}-${dateStr}`, emoji: ev.title.includes("🚫") ? "" : (ev.emoji || "📅"), title: ev.title, subtitle, colorClass: "bg-[#fef3e2]", url: ev.url });
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
        items.push({ key: `ev-${ev.id}`, emoji: ev.title.includes("🚫") ? "" : (ev.emoji || "📅"), title: ev.title, subtitle, colorClass: "bg-[#e8ffe8]", url: ev.url });
      }
    }
  }

  return items.slice(0, 20);
}