import type { Customer } from "@/types/database";

export type PaceInfo = {
  label: string;
  avgIntervalDays: number | null;
  elapsedDays: number | null;
  /** 平均来店周期を超えて来店していないか（第25章・第27章の通知判定に使用） */
  isOverdue: boolean;
};

type PaceInput = Pick<Customer, "visit_count" | "first_visit_at" | "last_visit_at">;

/**
 * 来店ペース分析（第27章）。
 * 平均来店間隔 = (最終来店日 - 初回来店日) / (来店回数 - 1)
 * 来店回数が1回以下の場合は「初来店」、来店履歴がない場合は「-」とする。
 */
export function computePace(customer: PaceInput): PaceInfo {
  if (!customer.first_visit_at || !customer.last_visit_at || customer.visit_count <= 0) {
    return { label: "-", avgIntervalDays: null, elapsedDays: null, isOverdue: false };
  }

  if (customer.visit_count === 1) {
    return { label: "初来店", avgIntervalDays: null, elapsedDays: 0, isOverdue: false };
  }

  const first = new Date(customer.first_visit_at).getTime();
  const last = new Date(customer.last_visit_at).getTime();
  const dayMs = 1000 * 60 * 60 * 24;

  const avgIntervalDays = Math.max(1, (last - first) / dayMs / (customer.visit_count - 1));
  const elapsedDays = Math.max(0, (Date.now() - last) / dayMs);

  let label: string;
  if (elapsedDays >= 180) {
    label = "半年以上来店なし";
  } else if (elapsedDays >= 90) {
    label = "3か月ぶり";
  } else if (avgIntervalDays <= 8) {
    label = "毎週";
  } else if (avgIntervalDays <= 16) {
    label = "月2回";
  } else if (avgIntervalDays <= 35) {
    label = "月1回";
  } else if (avgIntervalDays <= 70) {
    label = "2か月に1回";
  } else {
    label = "不定期";
  }

  // 平均周期の1.5倍を超えて来店がない場合を「周期超過」とする
  const isOverdue = elapsedDays > avgIntervalDays * 1.5;

  return { label, avgIntervalDays, elapsedDays, isOverdue };
}
