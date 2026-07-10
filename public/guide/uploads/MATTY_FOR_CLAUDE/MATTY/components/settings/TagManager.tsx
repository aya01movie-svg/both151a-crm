"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { X } from "lucide-react";
import { createTagAction, deleteTagAction, type TagFormState } from "@/lib/actions/tags";
import { Button } from "@/components/ui/Button";
import type { Tag } from "@/types/database";

const initialState: TagFormState = { error: null };

export function TagManager({ tags }: { tags: Tag[] }) {
  const [state, formAction, pending] = useActionState(createTagAction, initialState);
  const [deletePending, startDelete] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  // RC3修正: action={formAction} を直接渡す標準パターンに統一する
  // （action内でformActionをラップして呼び出す方式は避ける）。
  // 送信完了を検知して入力欄をクリアするため、初回のstateオブジェクトを覚えておく。
  const initialStateRef = useRef(state);

  useEffect(() => {
    if (state !== initialStateRef.current && !state.error && inputRef.current) {
      inputRef.current.value = "";
    }
  }, [state]);

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        {tags.length === 0 && <p className="text-navy/40 text-sm">タグはまだありません。</p>}
        {tags.map((t) => (
          <span
            key={t.id}
            className="inline-flex items-center gap-1.5 bg-navy/5 text-navy rounded-full pl-3 pr-1.5 py-1 text-sm font-bold"
          >
            {t.name}
            <button
              type="button"
              disabled={deletePending}
              onClick={() => startDelete(() => deleteTagAction(t.id))}
              aria-label={`${t.name}を削除`}
              className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-navy/10 text-navy/50 disabled:opacity-40"
            >
              <X size={14} />
            </button>
          </span>
        ))}
      </div>

      <form action={formAction} className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          name="name"
          placeholder="新しいタグ名"
          className="flex-1 min-h-12 rounded-app border-2 border-navy/10 bg-white px-4 text-base text-navy focus:outline-none focus:border-gold"
        />
        <Button type="submit" variant="navy" disabled={pending} className="px-6">
          {pending ? "追加中…" : "追加"}
        </Button>
      </form>
      {state.error && <p className="text-danger text-sm font-bold mt-2">{state.error}</p>}
    </div>
  );
}
