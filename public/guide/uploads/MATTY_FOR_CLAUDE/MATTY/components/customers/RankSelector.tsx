"use client";

import { useState, useTransition } from "react";
import { updateCustomerRankAction } from "@/lib/actions/customers";
import type { CustomerRank } from "@/types/database";

const OPTIONS: { value: CustomerRank; label: string }[] = [
  { value: "first", label: "初来店" },
  { value: "regular", label: "常連" },
  { value: "vip", label: "VIP" },
  { value: "special", label: "特別" },
];

export function RankSelector({
  customerId,
  currentRank,
}: {
  customerId: string;
  currentRank: CustomerRank;
}) {
  const [rank, setRank] = useState(currentRank);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      <select
        value={rank}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value as CustomerRank;
          setRank(next);
          setError(null);
          startTransition(async () => {
            try {
              await updateCustomerRankAction(customerId, next);
            } catch (err) {
              setRank(currentRank);
              setError(err instanceof Error ? err.message : "変更に失敗しました。");
            }
          });
        }}
        className="min-h-9 rounded-app border-2 border-navy/10 bg-white px-2 text-xs font-bold text-navy"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <span className="text-danger text-xs font-bold">{error}</span>}
    </div>
  );
}
