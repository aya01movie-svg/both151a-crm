"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { searchCustomersAction } from "@/lib/actions/visits";

type Candidate = {
  id: string;
  display_name: string;
  kana: string | null;
  caution_level?: "none" | "caution" | "banned";
};

type Props = {
  label?: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  onSelect: (candidate: Candidate) => void;
  compact?: boolean;
};

/**
 * 顧客名オートコンプリート（第5章）。
 * 入力に応じて既存顧客候補を表示し、選択すると顧客IDが確定する。
 * 候補にない名前のまま確定した場合は「新規」として扱われる（呼び出し側の判断）。
 */
export function PersonAutocompleteField({
  label,
  placeholder,
  value,
  onChangeText,
  onSelect,
  compact,
}: Props) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!value.trim()) {
      return;
    }
    timerRef.current = setTimeout(() => {
      startTransition(async () => {
        const results = await searchCustomersAction(value.trim());
        setCandidates(results);
        setOpen(true);
      });
    }, 200);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value, startTransition]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      {label && (
        <span className="block text-sm font-bold text-navy/70 mb-1.5">{label}</span>
      )}
      <input
        value={value}
        onChange={(e) => onChangeText(e.target.value)}
        onFocus={() => value.trim() && setOpen(true)}
        placeholder={placeholder}
        className={`w-full rounded-app border-2 border-navy/10 bg-white px-4 text-base text-navy placeholder:text-navy/30 focus:outline-none focus:border-gold transition-colors ${
          compact ? "min-h-12" : "min-h-14"
        }`}
      />
      {open && value.trim() && candidates.length > 0 && (
        <ul className="absolute z-30 mt-1 w-full bg-white rounded-app shadow-lg border border-navy/10 max-h-56 overflow-y-auto">
          {candidates.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(c);
                  setOpen(false);
                }}
                className="w-full text-left px-4 py-2.5 hover:bg-beige text-sm"
              >
                <span className="font-bold text-navy">{c.display_name}</span>
                {c.kana && <span className="text-navy/40 ml-2">{c.kana}</span>}
                {c.caution_level === "banned" && (
                  <span className="ml-2 text-[10px] font-bold text-white bg-danger rounded-full px-2 py-0.5">
                    ⛔ 出禁
                  </span>
                )}
                {c.caution_level === "caution" && (
                  <span className="ml-2 text-[10px] font-bold text-white bg-warn rounded-full px-2 py-0.5">
                    ⚠️ 注意
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
