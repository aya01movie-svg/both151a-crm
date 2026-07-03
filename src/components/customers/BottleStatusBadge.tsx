import type { Bottle } from "@/types/database";
import { getExpiryTier, EXPIRY_TIER_META } from "@/lib/bottle-expiry";

const STATUS_LABEL: Record<Bottle["status"], string> = {
  kept: "預かり中",
  finished: "飲み切り",
  returned: "返却",
  disposed: "廃棄",
};

/**
 * ボトルの状態バッジ。
 * 預かり中のボトルは期限までの日数で5段階に色分けする（ご指定仕様）。
 * 🟢31日以上 / 🟠30日以内 / 🟡14日以内 / 🔴7日以内 / ⚫期限切れ
 */
export function BottleStatusBadge({ bottle }: { bottle: Bottle }) {
  if (bottle.status !== "kept") {
    return (
      <span className="text-xs font-bold text-navy/40 bg-navy/5 rounded-full px-2.5 py-1">
        {STATUS_LABEL[bottle.status]}
      </span>
    );
  }

  const tier = getExpiryTier(bottle.expiry_date);
  const { emoji, label, className } = EXPIRY_TIER_META[tier];

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold rounded-full px-2.5 py-1 ${className}`}>
      <span aria-hidden>{emoji}</span>
      {label}
    </span>
  );
}
