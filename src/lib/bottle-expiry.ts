export type ExpiryTier = "expired" | "within7" | "within14" | "within30" | "safe";

/** 期限日から今日までの日数（負数=期限切れ経過日数）を返す。 */
export function daysUntilExpiry(expiryDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  return Math.round((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * 期限までの日数から色分け区分を判定する（5段階・排他的）。
 * 🟢31日以上 / 🟠30日以内 / 🟡14日以内 / 🔴7日以内 / ⚫期限切れ
 */
export function getExpiryTier(expiryDate: string): ExpiryTier {
  const days = daysUntilExpiry(expiryDate);
  if (days < 0) return "expired";
  if (days <= 7) return "within7";
  if (days <= 14) return "within14";
  if (days <= 30) return "within30";
  return "safe";
}

export const EXPIRY_TIER_META: Record<
  ExpiryTier,
  { emoji: string; label: string; className: string }
> = {
  expired: { emoji: "⚫", label: "期限切れ", className: "bg-navy-dark text-white" },
  within7: { emoji: "🔴", label: "7日以内", className: "bg-danger text-white" },
  within14: { emoji: "🟡", label: "14日以内", className: "bg-[#eab308] text-navy-dark" },
  within30: { emoji: "🟠", label: "30日以内", className: "bg-warn text-white" },
  safe: { emoji: "🟢", label: "31日以上", className: "bg-success text-white" },
};
