"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveStoreEventAction, deleteStoreEventAction } from "@/lib/actions/events";
import type { StoreEvent } from "@/lib/data/events";

const WEEKDAY_JA = ["日", "月", "火", "水", "木", "金", "土"];

/** スタッフ休みクイックボタン（表示は「🐑休」のように動物＋休で表現） */
const STAFF_EMOJIS = [
  { emoji: "🐑", label: "スタッフA" },
  { emoji: "🐯", label: "スタッフB" },
  { emoji: "🐰", label: "スタッフC" },
];

type ScheduleType = "single" | "range" | "weekly" | "annual";

function blank(): Partial<StoreEvent> {
  return {
    title: "",
    // v1.2修正: 絵文字を自動で付けない。頭に付けたい絵文字がある場合は
    // タイトル欄に直接入力してもらう（例: 「⛩豊平神社」とそのまま入力）。
    emoji: "",
    event_type: "other",
    schedule_type: "single",
    is_active: true,
  };
}

/** v1.3追加: 「＋カレンダーに反映させたいイベント」用の初期値。
 *  event_type を "calendar" 固定にすることで、通常イベント（お知らせページのみ表示）と
 *  区別し、カレンダー本体（グリッド＋選択日の詳細）にも反映されるようにする。
 *  日程は単発日付のみ（schedule_type固定: single）。 */
function calBlank(): Partial<StoreEvent> {
  return {
    title: "",
    emoji: "",
    event_type: "calendar",
    schedule_type: "single",
    memo: "",
    is_active: true,
  };
}

export function EventManagePanel({ events }: { events: StoreEvent[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<Partial<StoreEvent> | null>(null);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  // v1.2修正: イベント一覧が長い場合、下の方の項目で「編集」を押すと
  // フォーム自体はパネル上部に開くが画面外（スクロール外）になり、
  // 反応していないように見えていた。編集開始時にフォームまで
  // 自動スクロールするようにする。
  const formRef = useRef<HTMLDivElement>(null);

  // v1.3追加: 「＋カレンダーに反映させたいイベント」専用の編集状態（通常イベントの
  // フォームとは独立させ、日程タイプ選択やURL欄など不要な項目を持たせない）。
  const [calEditing, setCalEditing] = useState<Partial<StoreEvent> | null>(null);
  const calFormRef = useRef<HTMLDivElement>(null);

  const todayStr = (() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}-${String(t.getDate()).padStart(2,"0")}`;
  })();
  // スタッフ休み登録用の日付（日付選択に対応。デフォルトは今日）
  const [staffOffDate, setStaffOffDate] = useState(todayStr);

  function startNew() { setEditing(blank()); setMessage(null); }
  function startEdit(ev: StoreEvent) { setEditing({ ...ev }); setMessage(null); }
  function cancel() { setEditing(null); }

  useEffect(() => {
    if (editing) {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [editing]);

  function startCalNew() { setCalEditing({ ...calBlank(), start_date: todayStr, end_date: todayStr }); setMessage(null); }
  function startCalEdit(ev: StoreEvent) { setCalEditing({ ...ev }); setMessage(null); }
  function cancelCal() { setCalEditing(null); }

  useEffect(() => {
    if (calEditing) {
      calFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [calEditing]);

  /** スタッフ休みを選択した日付で登録（未選択時は当日）。表示は「🐑休」の形。 */
  function quickStaffOff(emoji: string, label: string) {
    const dateStr = staffOffDate || todayStr;
    startTransition(async () => {
      try {
        await saveStoreEventAction({
          title: "休",
          emoji,
          event_type: "staff",
          schedule_type: "single",
          start_date: dateStr,
          end_date: dateStr,
        });
        setMessage({ type: "ok", text: `${label}${emoji}休を登録しました（${dateStr}）` });
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
          // v1.2修正: 絵文字を自動で補完しない。ユーザーがタイトルに直接
          // 絵文字を入力する運用のため、空欄なら空欄のまま保存する。
          emoji: editing.emoji || "",
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

  /** v1.3追加: 「カレンダーに反映させたいイベント」の保存処理。
   *  絵文字はカレンダーのマス目に直接表示されるため、タイトルと同様に必須とする。 */
  function saveCal() {
    if (!calEditing?.title?.trim()) { setMessage({ type: "err", text: "タイトルを入力してください。" }); return; }
    if (!calEditing?.emoji?.trim()) { setMessage({ type: "err", text: "絵文字を入力してください（カレンダーのマス目に表示されます）。" }); return; }
    if (!calEditing?.start_date) { setMessage({ type: "err", text: "日付を選択してください。" }); return; }
    startTransition(async () => {
      try {
        await saveStoreEventAction({
          id: calEditing.id,
          title: calEditing.title!,
          emoji: calEditing.emoji!,
          event_type: "calendar",
          schedule_type: "single",
          start_date: calEditing.start_date,
          end_date: calEditing.start_date,
          memo: calEditing.memo,
        });
        setMessage({ type: "ok", text: "カレンダーに反映しました。" });
        setCalEditing(null);
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

  // v1.2修正: 通常イベント（年間を通して全件表示・上限なし）と、
  // スタッフ休み（過去分も削除せず件数が増えるため、フォルダにまとめる）を分ける。
  // v1.3修正: 「カレンダーに反映させたいイベント」(event_type==="calendar") も
  // 独立した一覧として分離する。
  const generalEvents = events.filter((ev) => ev.event_type !== "staff" && ev.event_type !== "calendar");
  const staffEvents = events.filter((ev) => ev.event_type === "staff");
  const calendarEvents = events.filter((ev) => ev.event_type === "calendar");

  return (
    <div className="flex flex-col gap-4">
      {/* メッセージ */}
      {message && (
        <p className={`text-sm font-bold p-3 rounded-app ${message.type === "ok" ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
          {message.text}
        </p>
      )}

      {/* スタッフ休みクイックボタン（日付選択対応） */}
      <div>
        <p className="text-xs font-bold text-navy/50 mb-2">スタッフ休みを登録</p>
        <div className="mb-2">
          <input type="date" value={staffOffDate}
            onChange={(e) => setStaffOffDate(e.target.value)}
            className="min-h-11 rounded-app border-2 border-navy/10 bg-white px-3 text-sm focus:outline-none focus:border-gold" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {STAFF_EMOJIS.map((s) => (
            <button key={s.emoji} type="button" disabled={pending}
              onClick={() => quickStaffOff(s.emoji, s.label)}
              title={s.label}
              className="px-4 py-2.5 rounded-app border-2 border-navy/10 bg-white hover:bg-navy/5 disabled:opacity-40">
              <span className="text-xl leading-none">{s.emoji}<span className="text-danger font-black text-base">休</span></span>
            </button>
          ))}
        </div>
      </div>

      {/* 新規フォーム */}
      {editing ? (
        <div ref={formRef} className="flex flex-col gap-3 p-4 rounded-app border-2 border-gold/40 bg-gold/5">
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

      {/* ══════════════════════════════════════════════════
          v1.3追加: ＋カレンダーに反映させたいイベント
          （「＋ 新しいイベントを追加」の直下に配置。カレンダー本体の
          グリッド上には絵文字のみ表示し、日付タップで詳細パネルに
          タイトル全文とメモを表示する。） */}
      {calEditing ? (
        <div ref={calFormRef} className="flex flex-col gap-3 p-4 rounded-app border-2 border-info/40 bg-info/5">
          <p className="text-xs font-black text-info">＋カレンダーに反映させたいイベント</p>

          {/* タイトル + 絵文字 */}
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <p className="text-xs font-bold text-navy/50 mb-1">タイトル</p>
              <input type="text" value={calEditing.title || ""}
                onChange={(e) => setCalEditing((ev) => ({ ...ev, title: e.target.value }))}
                placeholder="例：🍴やかた17:00"
                className="w-full min-h-11 rounded-app border-2 border-navy/10 bg-white px-3 text-sm text-navy focus:outline-none focus:border-gold" />
            </div>
            <div className="w-20 shrink-0">
              <p className="text-xs font-bold text-navy/50 mb-1">絵文字</p>
              <input type="text" value={calEditing.emoji || ""}
                onChange={(e) => setCalEditing((ev) => ({ ...ev, emoji: e.target.value }))}
                placeholder="🍴"
                maxLength={8}
                className="w-full min-h-11 rounded-app border-2 border-navy/10 bg-white px-2 text-xl text-center focus:outline-none focus:border-gold" />
            </div>
          </div>
          <p className="text-[11px] text-navy/40 -mt-2">
            ※ カレンダーのマス目には「絵文字」欄の内容のみ表示されます。タイトルは日付をタップした時の詳細に表示されます。
          </p>

          {/* 日付 */}
          <div>
            <p className="text-xs font-bold text-navy/50 mb-1">日付</p>
            <input type="date" value={calEditing.start_date || ""}
              onChange={(e) => setCalEditing((ev) => ({ ...ev, start_date: e.target.value, end_date: e.target.value }))}
              className="min-h-11 rounded-app border-2 border-navy/10 bg-white px-3 text-sm focus:outline-none focus:border-gold" />
          </div>

          {/* メモ */}
          <div>
            <p className="text-xs font-bold text-navy/50 mb-1">メモ（任意）</p>
            <textarea value={calEditing.memo || ""}
              onChange={(e) => setCalEditing((ev) => ({ ...ev, memo: e.target.value }))}
              placeholder="例：●●を渡す"
              rows={3}
              className="w-full rounded-app border-2 border-navy/10 bg-white px-3 py-2 text-sm text-navy focus:outline-none focus:border-gold resize-none" />
          </div>

          {/* ボタン */}
          <div className="flex gap-2">
            <button type="button" onClick={saveCal} disabled={pending}
              className="flex-1 min-h-12 rounded-app bg-info text-white font-bold text-sm disabled:opacity-50">
              {pending ? "保存中…" : "保存"}
            </button>
            <button type="button" onClick={cancelCal}
              className="min-h-12 px-4 rounded-app border-2 border-navy/10 text-navy/60 text-sm font-bold">
              キャンセル
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={startCalNew}
          className="min-h-12 rounded-app border-2 border-dashed border-info/40 text-info text-sm font-bold hover:bg-info/5">
          ＋カレンダーに反映させたいイベント
        </button>
      )}

      {/* カレンダー反映イベント一覧（上限なし・全件表示） */}
      <ul className="flex flex-col gap-2">
        {calendarEvents.map((ev) => (
          <EventListItem key={ev.id} ev={ev} onEdit={startCalEdit} onRemove={remove} pending={pending} />
        ))}
        {calendarEvents.length === 0 && (
          <p className="text-navy/30 text-xs">まだカレンダーに反映させたイベントがありません。</p>
        )}
      </ul>

      {/* 登録済み一覧（通常イベント：件数上限なし・全件表示） */}
      <ul className="flex flex-col gap-2">
        {generalEvents.map((ev) => (
          <EventListItem key={ev.id} ev={ev} onEdit={startEdit} onRemove={remove} pending={pending} />
        ))}
        {generalEvents.length === 0 && (
          <p className="text-navy/30 text-sm">まだイベントが登録されていません。</p>
        )}
      </ul>

      {/* スタッフ休み一覧（過去分も削除しないため、フォルダにまとめて格納） */}
      {staffEvents.length > 0 && (
        <details className="rounded-app border border-navy/10 bg-navy/[0.02]">
          <summary className="cursor-pointer select-none px-3 py-2.5 text-sm font-bold text-navy/60 flex items-center gap-1.5">
            📁 スタッフ休み一覧（{staffEvents.length}件）
          </summary>
          <ul className="flex flex-col gap-2 p-3 pt-0">
            {staffEvents.map((ev) => (
              <EventListItem key={ev.id} ev={ev} onEdit={startEdit} onRemove={remove} pending={pending} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function EventListItem({
  ev, onEdit, onRemove, pending,
}: {
  ev: StoreEvent;
  onEdit: (ev: StoreEvent) => void;
  onRemove: (id: string, title: string) => void;
  pending: boolean;
}) {
  return (
    <li className="flex items-start gap-2 p-3 rounded-app border border-navy/5 bg-white">
      {ev.emoji && <span className="text-xl shrink-0">{ev.emoji}</span>}
      <div className="flex-1 min-w-0">
        <p className="font-bold text-navy text-sm truncate">
          {ev.event_type === "staff" ? (
            <span className="text-danger">{ev.title}</span>
          ) : ev.url ? (
            <a href={ev.url} target="_blank" rel="noopener noreferrer" className="underline text-info">{ev.title}</a>
          ) : (
            ev.title
          )}
        </p>
        <p className="text-xs text-navy/40">
          {ev.schedule_type === "weekly"  ? `毎週${WEEKDAY_JA[ev.weekly_day ?? 0]}曜日` :
           ev.schedule_type === "annual"  ? `毎年${ev.annual_month}/${ev.annual_day}` :
           ev.schedule_type === "range"   ? `${ev.start_date}〜${ev.end_date}` :
           ev.start_date || ""}
        </p>
        {ev.event_type === "calendar" && ev.memo && (
          <p className="text-xs text-navy/50 mt-1 whitespace-pre-wrap">{ev.memo}</p>
        )}
      </div>
      <div className="flex gap-1.5 shrink-0">
        <button type="button" onClick={() => onEdit(ev)} className="text-xs text-navy/50 underline">編集</button>
        <button type="button" onClick={() => onRemove(ev.id, ev.title)} disabled={pending}
          className="text-xs text-danger underline disabled:opacity-40">削除</button>
      </div>
    </li>
  );
}
