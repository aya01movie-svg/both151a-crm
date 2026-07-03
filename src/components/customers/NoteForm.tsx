"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addNoteAction, type AddNoteState } from "@/lib/actions/notes";
import { Button } from "@/components/ui/Button";
import { enqueueWrite } from "@/lib/offline/queue";

const initialState: AddNoteState = { error: null };

export function NoteForm({ customerId }: { customerId: string }) {
  const [state, formAction, pending] = useActionState(addNoteAction, initialState);
  const [offlineMessage, setOfflineMessage] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // RC3修正: action={formAction} を直接渡す標準パターンに統一する
  // （actionをラップしてformActionを内部で呼び出す方式は避ける）。
  const initialStateRef = useRef(state);

  useEffect(() => {
    if (state !== initialStateRef.current && !state.error && textareaRef.current) {
      textareaRef.current.value = "";
    }
  }, [state]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (typeof navigator === "undefined" || navigator.onLine) {
      setOfflineMessage(null);
      return; // オンライン: action={formAction} にそのまま任せる
    }

    // 第38章: オフライン時は端末に一時保存し、復旧後にSyncManagerが自動送信する
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    await enqueueWrite("note", formData);
    setOfflineMessage("オフラインのため端末に保存しました。復旧後に自動送信されます。");
    if (textareaRef.current) textareaRef.current.value = "";
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} className="flex flex-col gap-2 mt-3">
      <input type="hidden" name="customer_id" value={customerId} />
      <textarea
        ref={textareaRef}
        name="note"
        rows={2}
        placeholder="メモを追加（上書きではなく追加されます）"
        className="w-full rounded-app border-2 border-navy/10 bg-white px-3 py-2 text-sm text-navy placeholder:text-navy/30 focus:outline-none focus:border-gold transition-colors"
      />
      {state.error && <p className="text-danger text-xs font-bold">{state.error}</p>}
      {offlineMessage && <p className="text-warn text-xs font-bold">{offlineMessage}</p>}
      <Button type="submit" variant="outline" disabled={pending} className="self-end px-4 min-h-10">
        {pending ? "追加中…" : "メモを追加"}
      </Button>
    </form>
  );
}
