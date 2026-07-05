import Link from "next/link";
import type { CustomerWithMonthStats } from "@/types/database";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { RankBadge } from "./RankBadge";
import { FavoriteToggle } from "./FavoriteToggle";
import { daysSince, yen } from "@/lib/date";
import { computePace } from "@/lib/pace";

export function CustomerCard({
  customer,
  secondaryAction = "reservation",
}: {
  customer: CustomerWithMonthStats;
  secondaryAction?: "reservation" | "detail";
}) {
  const pace = computePace(customer);
  return (
    <Card className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <Link
            href={`/customers/${customer.id}`}
            className="text-lg font-black text-navy hover:underline"
          >
            {customer.display_name}
          </Link>
          <FavoriteToggle customerId={customer.id} favorite={customer.favorite} size={16} />
          <RankBadge rank={customer.rank} />
          {customer.caution_level === "banned" && (
            <span className="text-[11px] font-bold text-white bg-danger rounded-full px-2 py-0.5">
              ⛔ 出禁
            </span>
          )}
          {customer.caution_level === "caution" && (
            <span className="text-[11px] font-bold text-white bg-warn rounded-full px-2 py-0.5">
              ⚠️ 注意
            </span>
          )}
          {customer.tags.map((t) => (
            <span
              key={t.id}
              className="text-[11px] font-bold text-navy/50 bg-navy/5 rounded-full px-2 py-0.5"
            >
              {t.name}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-navy/60">
          <span>
            来店{customer.visit_count}回 / 今月{customer.month_visit_count}回
          </span>
          <span>
            最終
            {customer.last_visit_at ? `${daysSince(customer.last_visit_at)}日前` : "来店なし"}
          </span>
          <span className="font-bold text-navy">
            今月売上 {yen(customer.month_amount)}
          </span>
          {customer.current_bottle_count > 0 && (
            <span className="text-warn font-bold">
              🍷{customer.current_bottle_count}本
            </span>
          )}
          {pace.label !== "-" && (
            <span className="text-success font-bold">来店ペース：{pace.label}</span>
          )}
        </div>
      </div>

      <div className="flex gap-2 shrink-0">
        <LinkButton href={`/visits/new?customer=${customer.id}`} variant="gold" className="px-4">
          来店
        </LinkButton>
        {secondaryAction === "reservation" ? (
          <LinkButton href={`/reservations?customer=${customer.id}`} variant="navy" className="px-4">
            予約
          </LinkButton>
        ) : (
          <LinkButton href={`/customers/${customer.id}`} variant="navy" className="px-4">
            詳細
          </LinkButton>
        )}
      </div>
    </Card>
  );
}
