"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { BottleStatusFilter } from "@/lib/data/bottles";

// v1.2: ボトル期限廃止のため expiring30/expired フィルターを削除
const OPTIONS: { value: BottleStatusFilter; label: string; emoji: string }[] = [
  { value: "kept",     label: "預かり中", emoji: "🍷" },
  { value: "finished", label: "飲み切り", emoji: "" },
  { value: "returned", label: "返却",     emoji: "" },
  { value: "disposed", label: "廃棄",     emoji: "" },
];

export function BottleStatusFilterBar({ selected }: { selected: BottleStatusFilter[] }) {
  const router    = useRouter();
  const pathname  = usePathname();
  const searchParams = useSearchParams();

  function select(value: BottleStatusFilter) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("status");
    params.delete("page");
    const alreadySelected = selected.length === 1 && selected[0] === value;
    if (!alreadySelected) params.append("status", value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => select(opt.value)}
          className={`px-4 py-2.5 rounded-app text-base font-bold border-2 transition-colors ${
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
