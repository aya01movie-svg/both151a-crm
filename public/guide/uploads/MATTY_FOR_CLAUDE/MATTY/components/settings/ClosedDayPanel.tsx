"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveClosedDayAction, deleteClosedDayAction } from "@/lib/actions/events";
import type { ClosedDay } from "@/lib/data/events";

export function ClosedDayPanel({ closedDays }: { closedDays: ClosedDay[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  function handleAdd() {
    if (!date) { setMessage({ type: "err", text: "日付を入力してください。" }); return; }
    startTransition(async () => {
      try {
        await saveClosedDayAction(date, note);
        setMessage({ type: "ok", text: `${date} を店休日に登録しました。` });
        setDate("");
        setNote("");
        router.refresh();
      } catch (e) {
        setMessage({ type: "err", text: e instanceof Error ? e.message : "保存に失敗しました。" });
      }
    });
  }

  function handleDelete(id: string, d: string) {
    if (!confirm(`${d} の店休日設定を削除しますか？`)) return;
    startTransition(async () => {
      await deleteClosedDayAction(id);
      setMessage({ type: "ok", text: "削除しました。" });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {message && (
        <p className={`text-sm font-bold p-3 rounded-app ${message.type === "ok" ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
          {message.text}
        </p>
      )}

      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <p className="text-xs font-bold text-navy/50 mb-1">日付</p>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="min-h-11 rounded-app border-2 border-navy/10 bg-white px-3 text-sm focus:outline-none focus:border-gold" />
        </div>
        <div className="flex-1 min-w-32">
          <p className="text-xs font-bold text-navy/50 mb-1">メモ（任意）</p>
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="例：定休日"
            className="w-full min-h-11 rounded-app border-2 border-navy/10 bg-white px-3 text-sm focus:outline-none focus:border-gold" />
        </div>
        <button type="button" onClick={handleAdd} disabled={pending || !date}
          className="min-h-11 px-4 rounded-app bg-navy text-white text-sm font-bold disabled:opacity-50">
          追加
        </button>
      </div>

      <ul className="flex flex-col gap-1.5 max-h-64 overflow-y-auto">
        {closedDays.map((cd) => (
          <li key={cd.id} className="flex items-center gap-2 p-2 rounded-app bg-[#fde8e8] border border-danger/10">
            <span className="text-lg">🚫</span>
            <span className="flex-1 text-sm font-bold text-navy">{cd.date}{cd.note ? ` — ${cd.note}` : ""}</span>
            <button type="button" onClick={() => handleDelete(cd.id, cd.date)} disabled={pending}
              className="text-xs text-danger underline disabled:opacity-40">削除</button>
          </li>
        ))}
        {closedDays.length === 0 && (
          <p className="text-navy/30 text-sm">店休日は登録されていません。</p>
        )}
      </ul>
    </div>
  );
}
