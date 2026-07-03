"use client";

import { useTransition } from "react";
import { LinkButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cancelReservationAction } from "@/lib/actions/reservations";
import { formatDateTime } from "@/lib/date";
import type { ReservationWithCustomer } from "@/lib/data/reservations";

const STATUS_STYLE: Record<string, { label: string; className: string }> = {
  reserved: { label: "予約中", className: "bg-info/15 text-info" },
  visited: { label: "来店済み", className: "bg-success/15 text-success" },
  cancelled: { label: "キャンセル", className: "bg-navy/10 text-navy/40" },
};

export function ReservationListItem({
  reservation,
  showDate = false,
}: {
  reservation: ReservationWithCustomer;
  showDate?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const status = STATUS_STYLE[reservation.status] ?? STATUS_STYLE.reserved;

  return (
    <Card
      className={`flex items-center justify-between gap-3 ${
        reservation.status === "cancelled" ? "opacity-60" : ""
      }`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-black text-navy">
            {showDate
              ? formatDateTime(reservation.reserved_at)
              : formatDateTime(reservation.reserved_at).split(" ")[1]}{" "}
            <span className="font-bold">{reservation.customer_display_name}</span>
          </p>
          <span
            className={`text-xs font-bold rounded-full px-2.5 py-1 shrink-0 ${status.className}`}
          >
            {status.label}
          </span>
          {reservation.customer_caution_level === "banned" && (
            <span className="text-xs font-bold text-white bg-danger rounded-full px-2.5 py-1 shrink-0">
              ⛔ 出禁
            </span>
          )}
          {reservation.customer_caution_level === "caution" && (
            <span className="text-xs font-bold text-white bg-warn rounded-full px-2.5 py-1 shrink-0">
              ⚠️ 注意
            </span>
          )}
        </div>
        <p className="text-xs text-navy/50 mt-0.5">
          {reservation.people_count}名
          {reservation.bottle_plan ? "・ボトル予定あり" : ""}
          {reservation.companion_names.length > 0
            ? `・同伴：${reservation.companion_names.join("、")}`
            : ""}
        </p>
        {reservation.memo && (
          <p className="text-xs text-navy/40 mt-0.5">{reservation.memo}</p>
        )}
      </div>
      <div className="flex gap-2 shrink-0">
        {reservation.status === "reserved" && (
          <>
            <LinkButton
              href={`/visits/new?reservation=${reservation.id}`}
              variant="gold"
              className="px-4"
            >
              来店登録へ
            </LinkButton>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(() => cancelReservationAction(reservation.id))
              }
              className="btn-base px-4 bg-white text-navy/50 border-2 border-navy/10 hover:bg-navy/5 disabled:opacity-40"
            >
              キャンセル
            </button>
          </>
        )}
      </div>
    </Card>
  );
}
