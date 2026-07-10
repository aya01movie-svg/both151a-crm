"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addChampagneAction } from "@/lib/actions/bottles";
import { Button } from "@/components/ui/Button";

const CHAMPAGNE_CANDIDATES = [
  "モエ ブリュット",
  "モエ ロゼ",
  "ドンペリ ブリュット",
  "ドンペリ ロゼ",
  "ローランペリエ",
  "クリュッグ",
  "ヴーヴクリコ",
  "ポルロジェ",
  "テタンジェ",
  "ボランジェ",
];

const initialState = { error: null };

export function ChampagneAddForm({ customerId }: { customerId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(addChampagneAction, initialState);
  const [name, setName] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const initialStateRef = useRef(state);

  useEffect(() => {
    if (state !== initialStateRef.current && !state.error) {
      formRef.current?.reset();
      setName("");
      setOpen(false);
    }
  }, [state]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-base w-full mt-3 bg-[#7a4fa3] text-white"
      >
        🍾 シャンパン追加
      </button>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2 mt-3 border-t border-navy/10 pt-3">
      <input type="hidden" name="customer_id" value={customerId} />

      <p className="text-xs font-bold text-[#7a4fa3]">🍾 シャンパン登録</p>

      {/* 候補ボタン */}
      <div className="flex flex-wrap gap-1.5">
        {CHAMPAGNE_CANDIDATES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setName(c)}
            className={`px-2 py-1 rounded-full text-xs font-bold border transition-colors ${
              name === c
                ? "bg-[#7a4fa3] border-[#7a4fa3] text-white"
                : "bg-white border-navy/10 text-navy/50 hover:bg-navy/5"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* 名前（手入力可） */}
      <input
        type="text"
        name="champagne_name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="シャンパン名（候補にない場合は手入力）"
        className="w-full min-h-11 rounded-app border-2 border-navy/10 bg-white px-3 text-sm text-navy focus:outline-none focus:border-[#7a4fa3]"
        required
      />

      <div className="grid grid-cols-3 gap-2">
        <label className="block">
          <span className="block text-xs font-bold text-navy/50 mb-1">本数</span>
          <input
            type="number"
            name="champagne_quantity"
            min={1}
            defaultValue={1}
            className="w-full min-h-11 rounded-app border-2 border-navy/10 bg-white px-3 text-sm text-navy focus:outline-none focus:border-gold"
          />
        </label>
        <label className="block col-span-2">
          <span className="block text-xs font-bold text-navy/50 mb-1">金額（円・売上に計上）</span>
          <input
            type="number"
            name="champagne_amount"
            min={0}
            step={1000}
            defaultValue={0}
            placeholder="例：30000"
            className="w-full min-h-11 rounded-app border-2 border-navy/10 bg-white px-3 text-sm text-navy focus:outline-none focus:border-gold"
          />
        </label>
      </div>

      <input
        type="text"
        name="champagne_memo"
        placeholder="メモ（任意）"
        className="w-full min-h-11 rounded-app border-2 border-navy/10 bg-white px-3 text-sm text-navy focus:outline-none focus:border-gold"
      />

      {state.error && <p className="text-danger text-xs font-bold">{state.error}</p>}

      <div className="flex gap-2">
        <Button type="submit" variant="navy" fullWidth disabled={pending}>
          {pending ? "追加中…" : "追加"}
        </Button>
        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
          閉じる
        </Button>
      </div>
    </form>
  );
}
