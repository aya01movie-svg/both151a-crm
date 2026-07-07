"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addBottleAction, type BottleFormState } from "@/lib/actions/bottles";
import { Button } from "@/components/ui/Button";
import { BOTTLE_TYPE_CANDIDATES } from "@/lib/bottle-types";

const initialState: BottleFormState = { error: null };

export function BottleAddForm({
  customerId,
  autoOpen = false,
}: {
  customerId: string;
  autoOpen?: boolean;
}) {
  const [open, setOpen] = useState(autoOpen);
  const [state, formAction, pending] = useActionState(addBottleAction, initialState);
  const [bottleType, setBottleType] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const initialStateRef = useRef(state);

  useEffect(() => {
    if (state !== initialStateRef.current && !state.error) {
      formRef.current?.reset();
      setBottleType("");
      setOpen(false);
    }
  }, [state]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-base w-full mt-3 bg-warn text-white"
      >
        ボトル追加
      </button>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2 mt-3 border-t border-navy/10 pt-3">
      <input type="hidden" name="customer_id" value={customerId} />
      <input type="hidden" name="bottle_type" value={bottleType} />
      {/* 期限はDBデフォルト値（登録日+1年）を使用 */}

      <span className="block text-xs font-bold text-navy/50">ボトルの種類</span>
      <div className="flex flex-wrap gap-1.5">
        {BOTTLE_TYPE_CANDIDATES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setBottleType(c)}
            className={`px-2 py-1 rounded-full text-xs font-bold border ${
              bottleType === c ? "bg-gold border-gold text-navy-dark" : "bg-white border-navy/10 text-navy/50"
            }`}
          >
            {c}
          </button>
        ))}
      </div>
      <input
        type="text"
        value={bottleType}
        onChange={(e) => setBottleType(e.target.value)}
        placeholder="候補にない場合は手入力"
        className="w-full min-h-11 rounded-app border-2 border-navy/10 bg-white px-3 text-sm text-navy focus:outline-none focus:border-gold"
      />
      <input
        type="text"
        name="bottle_name"
        placeholder="ボトルネーム（キープ札に書く名前・任意）"
        className="w-full min-h-11 rounded-app border-2 border-navy/10 bg-white px-3 text-sm text-navy focus:outline-none focus:border-gold"
      />
      <label className="block">
        <span className="block text-xs font-bold text-navy/50 mb-1">本数</span>
        <input
          type="number"
          name="quantity"
          min={1}
          defaultValue={1}
          className="w-full min-h-11 rounded-app border-2 border-navy/10 bg-white px-3 text-sm text-navy focus:outline-none focus:border-gold"
        />
      </label>
      <input
        type="text"
        name="memo"
        placeholder="メモ（任意）"
        className="w-full min-h-11 rounded-app border-2 border-navy/10 bg-white px-3 text-sm text-navy focus:outline-none focus:border-gold"
      />

      {state.error && <p className="text-danger text-xs font-bold">{state.error}</p>}
      <div className="flex gap-2">
        <Button type="submit" variant="gold" fullWidth disabled={pending}>
          {pending ? "追加中…" : "追加"}
        </Button>
        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
          閉じる
        </Button>
      </div>
    </form>
  );
}
