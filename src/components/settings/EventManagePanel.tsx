"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveStoreEventAction, deleteStoreEventAction } from "@/lib/actions/events";
import type { StoreEvent } from "@/lib/data/events";

const WEEKDAY_JA = ["日", "月", "火", "水", "木", "金", "土"];

/** スタッフ休みクイックボタン */
const STAFF_EMOJIS = [
  { emoji: "🐑", label: "スタッフA" },
  { emoji: "🐯", label: "スタッフB" },
  { emoji: "🐰", label: "スタッフC" },
];

type ScheduleType = "single" | "range" | "weekly" | "annual";

function blank(): Partial<StoreEvent> {
  return {
    title: "",
    emoji: "📅",
    event_type: "other",
    schedule_type: "single",
    is_active: true,
  };
}

export function EventManagePanel({ events }: { events: StoreEvent[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<Partial<StoreEvent> | null>(null);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  function startNew() { setEditing(blank()); setMessage(null); }
  function startEdit(ev: StoreEvent) { setEditing({ ...ev }); setMessage(null); }
  function cancel() { setEditing(null); }

  /** スタッフ休みを当日付で即登録 */
  function quickStaffOff(emoji: string, label: string) {
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
    startTransition(async () => {
      try {
        await saveStoreEventAction({
          title: `${label}お休み`,
          emoji,
          event_type: "staff",
          schedule_type: "single",
          start_date: dateStr,
          end_date: dateStr,
        });
        setMessage({ type: "ok", text: `${label}お休みを登録しました（${dateStr}）` });
        router.refresh();
      } catch (e) {
        setMessage({ type: "err", text: e instanceof Error ? e.message : "登録に失敗しました。" });
      }
    });
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
      {/* メッセージ */}
      {message && (
        <p className={`text-sm font-bold p-3 rounded-app ${message.type === "ok" ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
          {message.text}
        </p>
      )}

      {/* スタッフ休みクイックボタン */}
      <div>
        <p className="text-xs font-bold text-navy/50 mb-2">スタッフ休みを今日付で登録</p>
        <div className="flex gap-2 flex-wrap">
          {STAFF_EMOJIS.map((s) => (
            <button key={s.emoji} type="button" disabled={pending}
              onClick={() => quickStaffOff(s.emoji, s.label)}
              className="px-3 py-2 rounded-app border-2 border-navy/10 bg-white text-base font-bold hover:bg-navy/5 disabled:opacity-40">
              {s.emoji} {s.label} お休み
            </button>
          ))}
        </div>
      </div>

      {/* 新規フォーム */}
      {editing ? (
        <div className="flex flex-col gap-3 p-4 rounded-app border-2 border-gold/40 bg-gold/5">
          {/* タイトル */}
          <div>
            <p className="text-xs font-bold text-navy/50 mb-1">タイトル</p>
            <input type="text" value={editing.title || ""}
              onChange={(e) => setEditing((ev) => ({ ...ev, title: e.target.value }))}
              placeholder="イベント名を入力"
              className="w-full min-h-11 rounded-app border-2 border-navy/10 bg-white px-3 text-sm text-navy focus:outline-none focus:border-gold" />
          </div>

          {/* 日程タイプ */}
          <div>
            <p className="text-xs font-bold text-navy/50 mb-1">日程タイプ</p>
            <div className="flex flex-wrap gap-1.5">
              {(["single","range","weekly","annual"] as ScheduleType[]).map((s) => {
                const lbl = { single:"1日", range:"期間", weekly:"毎週", annual:"毎年" }[s];
                return (
                  <button key={s} type="button"
                    onClick={() => setEditing((ev) => ({ ...ev, schedule_type: s }))}
                    className={`px-3 py-1.5 rounded-app text-sm font-bold border ${schedType===s ? "bg-navy text-white border-navy" : "border-navy/10 text-navy/60"}`}>
                    {lbl}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 日程入力 */}
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
                  <button key={i} type="button"
                    onClick={() => setEditing((ev) => ({ ...ev, weekly_day: i }))}
                    className={`w-10 h-10 rounded-app text-sm font-bold border ${editing.weekly_day===i ? "bg-navy text-white border-navy" : "border-navy/10 text-navy/60"}`}>
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
                  {Array.from({length:12},(_,i)=>i+1).map((m)=>(
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
                  {Array.from({length:31},(_,i)=>i+1).map((d)=>(
                    <option key={d} value={d}>{d}日</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* URL（タイトルリンク用） */}
          <div>
            <p className="text-xs font-bold text-navy/50 mb-1">URL（任意・タイトルをリンク化）</p>
            <input type="url" value={editing.url || ""}
              onChange={(e) => setEditing((ev) => ({ ...ev, url: e.target.value }))}
              placeholder="https://..."
              className="w-full min-h-11 rounded-app border-2 border-navy/10 bg-white px-3 text-sm focus:outline-none focus:border-gold" />
          </div>

          {/* ボタン */}
          <div className="flex gap-2">
            <button type="button" onClick={save} disabled={pending}
              className="flex-1 min-h-12 rounded-app bg-navy text-white font-bold text-sm disabled:opacity-50">
              {pending ? "保存中…" : "保存"}
            </button>
            <button type="button" onClick={cancel}
              className="min-h-12 px-4 rounded-app border-2 border-navy/10 text-navy/60 text-sm font-bold">
              キャンセル
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={startNew}
          className="min-h-12 rounded-app border-2 border-dashed border-navy/20 text-navy/50 text-sm font-bold hover:bg-navy/5">
          ＋ 新しいイベントを追加
        </button>
      )}

      {/* 登録済み一覧 */}
      <ul className="flex flex-col gap-2">
        {events.map((ev) => (
          <li key={ev.id} className="flex items-start gap-2 p-3 rounded-app border border-navy/5 bg-white">
            <span className="text-xl shrink-0">{ev.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-navy text-sm truncate">
                {ev.url
                  ? <a href={ev.url} target="_blank" rel="noopener noreferrer" className="underline text-info">{ev.title}</a>
                  : ev.title}
              </p>
              <p className="text-xs text-navy/40">
                {ev.schedule_type === "weekly"  ? `毎週${WEEKDAY_JA[ev.weekly_day ?? 0]}曜日` :
                 ev.schedule_type === "annual"  ? `毎年${ev.annual_month}/${ev.annual_day}` :
                 ev.schedule_type === "range"   ? `${ev.start_date}〜${ev.end_date}` :
                 ev.start_date || ""}
                {ev.event_type === "staff" && " 🐑スタッフ"}
              </p>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <button type="button" onClick={() => startEdit(ev)} className="text-xs text-navy/50 underline">編集</button>
              <button type="button" onClick={() => remove(ev.id, ev.title)} disabled={pending}
                className="text-xs text-danger underline disabled:opacity-40">削除</button>
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
