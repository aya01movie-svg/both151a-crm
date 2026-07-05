"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { BottleStatusFilter } from "@/lib/data/bottles";

const OPTIONS: { value: BottleStatusFilter; label: string; emoji: string }[] = [
  { value: "kept", label: "預かり中", emoji: "🍷" },
  { value: "expiring30", label: "期限30日以内", emoji: "🟠" },
  { value: "expired", label: "期限切れ", emoji: "⚫" },
  { value: "finished", label: "飲み切り", emoji: "" },
  { value: "returned", label: "返却", emoji: "" },
  { value: "disposed", label: "廃棄", emoji: "" },
];

export function BottleStatusFilterBar({ selected }: { selected: BottleStatusFilter[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function select(value: BottleStatusFilter) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("status");
    params.delete("page");
    // RC6修正: 複数選択が残ってしまう不具合を修正し、単一選択にする
    // （同じボタンをもう一度押すと選択解除＝全件表示に戻る）
    const alreadySelected = selected.length === 1 && selected[0] === value;
    if (!alreadySelected) {
      params.append("status", value);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => select(opt.value)}
          className={`px-3 py-2 rounded-app text-sm font-bold border-2 transition-colors ${
            selected.includes(opt.value)
              ? "bg-navy text-white border-navy"
              : "bg-white text-navy/60 border-navy/10"
          }`}
        >
          {opt.emoji} {opt.label}
        </button>
      ))}
    </div>
  );
}
