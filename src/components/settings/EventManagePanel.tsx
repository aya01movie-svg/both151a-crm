"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveStoreEventAction, deleteStoreEventAction } from "@/lib/actions/events";
import type { StoreEvent } from "@/lib/data/events";

const WEEKDAY_JA = ["日", "月", "火", "水", "木", "金", "土"];
type ScheduleType = "single" | "range" | "weekly" | "annual";

export function EventManagePanel({ events }: { events: StoreEvent[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<Partial<StoreEvent> | null>(null);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  function startNew() {
    setEditing({ title: "", schedule_type: "single", is_active: true, emoji: "📅", event_type: "other" });
    setMessage(null);
  }
  function startEdit(ev: StoreEvent) {
    setEditing({ ...ev });
    setMessage(null);
  }
  function cancel() {
    setEditing(null);
  }
  function setStaffOff(staff: string) {
    setEditing((e) => ({ ...e, title: `${staff}🚫休み`, emoji: "", event_type: "staff" }));
  }

  function save() {
    if (!editing?.title?.trim()) { setMessage({ type: "err", text: "タイトルを入力してください。" }); return; }
    startTransition(async () => {
      try {
        await saveStoreEventAction({
          id: editing.id,
          title: editing.title!,
          emoji: editing.emoji || "📅",
          event_type: editing.event_type || "other",
          schedule_type: editing.schedule_type || "single",
          start_date: editing.start_date,
          end_date: editing.end_date,
          annual_month: editing.annual_month,
          annual_day: editing.annual_day,
          weekly_day: editing.weekly_day,
          url: editing.url,
          memo: editing.memo,
        });
        setMessage({ type: "ok", text: "保存しました。" });
        setEditing(null);
        router.refresh();
      } catch (e) {
        setMessage({ type: "err", text: e instanceof Error ? e.message : "保存に失敗しました。" });
      }
    });
  }

  function remove(id: string, title: string) {
    if (!confirm(`「${title}」を削除しますか？`)) return;
    startTransition(async () => {
      await deleteStoreEventAction(id);
      setMessage({ type: "ok", text: "削除しました。" });
      router.refresh();
    });
  }

  const schedType = (editing?.schedule_type || "single") as ScheduleType;

  return (
    <div className="flex flex-col gap-4">
      {message && (
        <p className={`text-sm font-bold p-3 rounded-app ${message.type === "ok" ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
          {message.text}
        </p>
      )}

      {editing ? (
        <div className="flex flex-col gap-3 p-4 rounded-app border-2 border-gold/40 bg-gold/5">
          
          <div>
            <p className="text-xs font-bold text-navy/50 mb-1.5">スタッフ休み入力（ワンタップ）</p>
            <div className="flex gap-2">
              {["🐑", "🐯", "🐰"].map(s => (
                <button key={s} type="button" onClick={() => setStaffOff(s)} className="px-3 py-1.5 rounded-app bg-white border border-navy/10 text-xl font-black shadow-sm hover:bg-navy/5">
                  {s}🚫
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-navy/50 mb-1 mt-2">タイトル</p>
            <input type="text" value={editing.title || ""} onChange={(e) => setEditing((ev) => ({ ...ev, title: e.target.value }))}
              placeholder="イベントタイトル"
              className="w-full min-h-11 rounded-app border-2 border-navy/10 bg-white px-3 text-sm text-navy focus:outline-none focus:border-gold" />
          </div>

          <div>
            <p className="text-xs font-bold text-navy/50 mb-1">日程タイプ</p>
            <div className="flex flex-wrap gap-1.5">
              {(["single","range","weekly","annual"] as ScheduleType[]).map((s) => {
                const lbl = { single: "1日", range: "期間", weekly: "毎週", annual: "毎年" }[s];
                return (
                  <button key={s} type="button" onClick={() => setEditing((ev) => ({ ...ev, schedule_type: s }))}
                    className={`px-3 py-1.5 rounded-app text-sm font-bold border ${schedType === s ? "bg-navy text-white border-navy" : "border-navy/10 text-navy/60"}`}>
                    {lbl}
                  </button>
                );
              })}
            </div>
          </div>

          {schedType === "single" && (
            <div>
              <p className="text-xs font-bold text-navy/50 mb-1">日付</p>
              <input type="date" value={editing.start_date || ""}
                onChange={(e) => setEditing((ev) => ({ ...ev, start_date: e.target.value, end_date: e.target.value }))}
                className="min-h-11 rounded-app border-2 border-navy/10 bg-white px-3 text-sm focus:outline-none focus:border-gold" />
            </div>
          )}
          {schedType === "range" && (
            <div className="flex items-center gap-2">
              <div>
                <p className="text-xs font-bold text-navy/50 mb-1">開始日</p>
                <input type="date" value={editing.start_date || ""}
                  onChange={(e) => setEditing((ev) => ({ ...ev, start_date: e.target.value }))}
                  className="min-h-11 rounded-app border-2 border-navy/10 bg-white px-3 text-sm focus:outline-none focus:border-gold" />
              </div>
              <span className="mt-5 text-navy/30">〜</span>
              <div>
                <p className="text-xs font-bold text-navy/50 mb-1">終了日</p>
                <input type="date" value={editing.end_date || ""}
                  onChange={(e) => setEditing((ev) => ({ ...ev, end_date: e.target.value }))}
                  className="min-h-11 rounded-app border-2 border-navy/10 bg-white px-3 text-sm focus:outline-none focus:border-gold" />
              </div>
            </div>
          )}
          {schedType === "weekly" && (
            <div>
              <p className="text-xs font-bold text-navy/50 mb-1">曜日</p>
              <div className="flex gap-1.5">
                {WEEKDAY_JA.map((d, i) => (
                  <button key={i} type="button" onClick={() => setEditing((ev) => ({ ...ev, weekly_day: i }))}
                    className={`w-10 h-10 rounded-app text-sm font-bold border ${editing.weekly_day === i ? "bg-navy text-white border-navy" : "border-navy/10 text-navy/60"}`}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}
          {schedType === "annual" && (
            <div className="flex items-center gap-2">
              <div>
                <p className="text-xs font-bold text-navy/50 mb-1">月</p>
                <select value={editing.annual_month || ""}
                  onChange={(e) => setEditing((ev) => ({ ...ev, annual_month: Number(e.target.value) || null }))}
                  className="min-h-11 rounded-app border-2 border-navy/10 bg-white px-2 text-sm focus:outline-none focus:border-gold">
                  <option value="">月</option>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>{m}月</option>
                  ))}
                </select>
              </div>
              <div>
                <p className="text-xs font-bold text-navy/50 mb-1">日</p>
                <select value={editing.annual_day || ""}
                  onChange={(e) => setEditing((ev) => ({ ...ev, annual_day: Number(e.target.value) || null }))}
                  className="min-h-11 rounded-app border-2 border-navy/10 bg-white px-2 text-sm focus:outline-none focus:border-gold">
                  <option value="">日</option>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>{d}日</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-bold text-navy/50 mb-1">URL（任意・タップで開けるようになります）</p>
            <input type="url" value={editing.url || ""} onChange={(e) => setEditing((ev) => ({ ...ev, url: e.target.value }))}
              placeholder="https://..."
              className="w-full min-h-11 rounded-app border-2 border-navy/10 bg-white px-3 text-sm focus:outline-none focus:border-gold" />
          </div>

          <div className="flex gap-2 mt-2">
            <button type="button" onClick={save} disabled={pending} className="flex-1 min-h-12 rounded-app bg-navy text-white font-bold text-sm disabled:opacity-50">
              {pending ? "保存中..." : "保存"}
            </button>
            <button type="button" onClick={cancel} className="min-h-12 px-4 rounded-app border-2 border-navy/10 text-navy/60 text-sm font-bold">
              キャンセル
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={startNew} className="min-h-12 rounded-app border-2 border-dashed border-navy/20 text-navy/50 text-sm font-bold hover:bg-navy/5">
          ＋ 新しいイベント・スタッフ休みを追加
        </button>
      )}

      <ul className="flex flex-col gap-2">
        {events.map((ev) => (
          <li key={ev.id} className="flex items-start gap-2 p-3 rounded-app border border-navy/5 bg-white">
            <div className="flex-1 min-w-0">
              {ev.url ? (
                <a href={ev.url} target="_blank" rel="noopener noreferrer" className="font-black text-info text-sm truncate hover:underline">
                  {ev.title}
                </a>
              ) : (
                <p className="font-bold text-navy text-sm truncate">{ev.title}</p>
              )}
              <p className="text-xs text-navy/40 mt-0.5">
                {ev.schedule_type === "weekly" ? `毎週${WEEKDAY_JA[ev.weekly_day ?? 0]}曜日` :
                 ev.schedule_type === "annual" ? `毎年${ev.annual_month}/${ev.annual_day}` :
                 ev.schedule_type === "range" ? `${ev.start_date}〜${ev.end_date}` :
                 ev.start_date || ""}
              </p>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <button type="button" onClick={() => startEdit(ev)} className="text-xs text-navy/50 underline">編集</button>
              <button type="button" onClick={() => remove(ev.id, ev.title)} disabled={pending} className="text-xs text-danger underline disabled:opacity-40">削除</button>
            </div>
          </li>
        ))}
        {events.length === 0 && (
          <p className="text-navy/30 text-sm">まだイベントが登録されていません。</p>
        )}
      </ul>
    </div>
  );
}