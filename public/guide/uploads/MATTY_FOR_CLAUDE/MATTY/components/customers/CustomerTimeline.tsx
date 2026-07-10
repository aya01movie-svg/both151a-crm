import { Card, CardTitle } from "@/components/ui/Card";
import { formatDate } from "@/lib/date";
import type { TimelineEvent } from "@/lib/data/timeline";

const KIND_META: Record<TimelineEvent["kind"], { emoji: string; color: string }> = {
  first_visit: { emoji: "🎉", color: "text-navy" },
  visit: { emoji: "🍸", color: "text-success" },
  bottle: { emoji: "🍷", color: "text-warn" },
  reservation: { emoji: "📅", color: "text-info" },
  note: { emoji: "📝", color: "text-navy/50" },
  champagne: { emoji: "🥂", color: "text-[#7a4fa3]" },
};

/** 顧客タイムライン（レビュー指摘⑫）：来店・ボトル・予約・メモを時系列で表示する。 */
export function CustomerTimeline({ events }: { events: TimelineEvent[] }) {
  return (
    <Card>
      <CardTitle>タイムライン</CardTitle>
      {events.length === 0 && (
        <p className="text-navy/40 text-sm">まだ履歴がありません。</p>
      )}
      <ul className="flex flex-col max-h-[500px] overflow-y-auto">
        {events.map((e, i) => {
          const meta = KIND_META[e.kind];
          const isFirstVisit = e.kind === "first_visit";
          return (
            <li key={e.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className="text-lg leading-none mt-0.5">{meta.emoji}</span>
                {i < events.length - 1 && <span className="flex-1 w-px bg-navy/10 my-1" />}
              </div>
              <div className="pb-4 min-w-0">
                <p className="text-xs text-navy/40">{formatDate(e.date)}</p>
                {isFirstVisit ? (
                  <span className="inline-block text-base font-black text-navy bg-gold rounded-full px-3 py-0.5 mt-0.5">
                    {e.title}
                  </span>
                ) : (
                  <p className={`text-sm font-bold ${meta.color}`}>{e.title}</p>
                )}
                {e.detail && (
                  <p className={`text-navy/50 truncate max-w-xs ${isFirstVisit ? "text-sm font-bold mt-1" : "text-xs"}`}>
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