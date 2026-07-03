"use client";

import { useTransition } from "react";
import { invalidateNoteAction } from "@/lib/actions/notes";

export function InvalidateNoteButton({
  noteId,
  customerId,
}: {
  noteId: string;
  customerId: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (confirm("このメモを無効化しますか？（本文は保持されますが一覧から非表示になります）")) {
          startTransition(() => invalidateNoteAction(noteId, customerId));
        }
      }}
      className="text-navy/30 text-xs underline disabled:opacity-40 shrink-0"
    >
      無効化
    </button>
  );
}
