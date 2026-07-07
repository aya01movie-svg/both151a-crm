import { Card, CardTitle } from "@/components/ui/Card";
import { formatDate } from "@/lib/date";
import type { TimelineEvent } from "@/lib/data/timeline";

const KIND_META: Record<TimelineEvent["kind"], { emoji: string; color: string }> = {
  first_visit: { emoji: "🎉", color: "text-gold" },
  visit: { emoji: "🍸", color: "text-success" },
  bottle: { emoji: "🍾", color: "text-warn" },
  reservation: { emoji: "📅", color: "text-info" },
  note: { emoji: "📝", color: "text-navy/50" },
  champagne: { emoji: "🥂", color: "text-[#7a4fa3]" },
};

export function CustomerTimeline({ events }: { events: TimelineEvent[] }) {
  return (
    <Card>
      <CardTitle>タイムライン</CardTitle>
      {events.length === 0 && (
        <p className="text-navy/40 text-sm">まだ履歴がありません。</p>
      )}
      <ul className="flex flex-col max-h-[500px] overflow-y-auto mt-2">
        {events.map((e, i) => {
          const meta = KIND_META[e.kind];
          return (
            <li key={e.id} className="flex gap-3 mb-2">
              <div className="flex flex-col items-center">
                <span className="text-xl leading-none mt-1">{meta.emoji}</span>
                {i < events.length - 1 && <span className="flex-1 w-px bg-navy/10 my-1" />}
              </div>
              <div className="pb-4 min-w-0 flex-1">
                <p className="text-sm text-navy/50 font-bold">{formatDate(e.date)}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className={`text-base font-bold ${meta.color}`}>{e.title}</p>
                  {e.kind === "first_visit" && (
                    <span className="bg-danger text-white text-xs font-black px-2 py-0.5 rounded shadow-sm">初来店</span>
                  )}
                </div>
                {e.detail && (
                  <p className={`mt-1 truncate max-w-full ${e.kind === "visit" || e.kind === "first_visit" ? "text-2xl font-black text-navy" : "text-sm text-navy/60"}`}>
                    {e.detail}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}