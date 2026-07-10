import type { CustomerRank } from "@/types/database";

const RANK_LABEL: Record<CustomerRank, string> = {
  first: "初来店",
  regular: "常連",
  vip: "VIP",
  special: "特別",
};

const RANK_CLASS: Record<CustomerRank, string> = {
  first: "bg-navy/10 text-navy/60",
  regular: "bg-gold/20 text-gold-dark",
  vip: "bg-[#efe4f7] text-[#7a4fa3]",
  special: "bg-[#fde7d4] text-warn",
};

export function RankBadge({ rank }: { rank: CustomerRank }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${RANK_CLASS[rank]}`}
    >
      {RANK_LABEL[rank]}
    </span>
  );
}
