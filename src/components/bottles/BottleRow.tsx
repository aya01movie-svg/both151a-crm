"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  extendBottleAction,
  setBottleExpiryAction,
  setBottleStatusAction,
  consumeBottleQuantityAction,
} from "@/lib/actions/bottles";
import { BottleStatusBadge } from "@/components/customers/BottleStatusBadge";
import { Card } from "@/components/ui/Card";
import { formatDate } from "@/lib/date";
import type { BottleWithCustomer } from "@/lib/data/bottles";
import type { BottleStatus } from "@/types/database";

const STATUS_OPTIONS: { value: BottleStatus; label: string }[] = [
  { value: "kept", label: "預かり中" },
  { value: "finished", label: "飲み切り" },
  { value: "returned", label: "返却" },
  { value: "disposed", label: "廃棄" },
];

export function BottleRow({ bottle }: { bottle: BottleWithCustomer }) {
  const [editing, setEditing] = useState(false);
  const [partialConsumeOpen, setPartialConsumeOpen] = useState(false);
  const [consumeQuantity, setConsumeQuantity] = useState(1);
  const [expiryInput, setExpiryInput] = useState(bottle.expiry_date);
  const [pending, startTransition] = useTransition();

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <Link
            href={`/customers/${bottle.customer_id}`}
            className="font-bold text-navy hover:underline"
          >
            {bottle.customer_display_name}
          </Link>
          <span className="text-navy/70 ml-2">
            {bottle.bottle_type && <span className="font-bold">{bottle.bottle_type}</span>}
            {bottle.bottle_type && bottle.bottle_name && bottle.bottle_name !== bottle.bottle_type && (
              <span className="text-navy/40">（{bottle.bottle_name}）</span>
            )}
            {!bottle.bottle_type && bottle.bottle_name}
            {bottle.quantity > 1 && <span className="text-navy/40 text-xs ml-1">×{bottle.quantity}</span>}
          </span>
          <p className="text-xs text-navy/40 mt-0.5">
            期限：{bottle.status === "kept" ? formatDate(bottle.expiry_date) : "対象外"}（登録 {formatDate(bottle.start_date)}）
          </p>
        </div>

        <div className="flex items-center gap-2">
          <BottleStatusBadge bottle={bottle} />
          {bottle.status === "kept" && (
            <>
              {[30, 90, 180].map((days) => (
                <button
                  key={days}
                  type="button"
                  disabled={pending}
                  onClick={() => startTransition(() => extendBottleAction(bottle.id, days))}
                  className="btn-base px-3 min-h-10 bg-gold text-navy-dark text-sm disabled:opacity-40"
                >
                  +{days}日
                </button>
              ))}
            </>
          )}
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="btn-base px-3 min-h-10 bg-navy text-white text-sm"
          >
            変更
          </button>
        </div>
      </div>

      {editing && (
        <div className="flex flex-wrap items-end gap-3 border-t border-navy/10 pt-3">
          <label className="block">
            <span className="block text-xs font-bold text-navy/50 mb-1">期限を自由入力</span>
            <input
              type="date"
              value={expiryInput}
              onChange={(e) => setExpiryInput(e.target.value)}
              className="min-h-11 rounded-app border-2 border-navy/10 bg-white px-3 text-sm"
            />
          </label>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(() => setBottleExpiryAction(bottle.id, expiryInput))
            }
            className="btn-base px-4 min-h-11 bg-navy text-white text-sm disabled:opacity-40"
          >
            期限を保存
          </button>

          <div className="flex flex-wrap gap-2 ml-auto">
            {bottle.quantity > 1 && bottle.status === "kept" && (
              <div className="w-full flex flex-wrap items-center gap-2 mb-1 bg-warn/5 rounded-app p-2">
                <label className="flex items-center gap-1.5 text-xs font-bold text-navy/60">
                  <input
                    type="checkbox"
                    checked={partialConsumeOpen}
                    onChange={(e) => setPartialConsumeOpen(e.target.checked)}
                    className="w-4 h-4 accent-warn"
                  />
                  一部だけ状態変更する
                </label>
                {partialConsumeOpen && (
                  <>
                    <input
                      type="number"
                      min={1}
                      max={bottle.quantity}
                      value={consumeQuantity}
                      onChange={(e) =>
                        setConsumeQuantity(
                          Math.max(1, Math.min(bottle.quantity, Number(e.target.value) || 1))
                        )
                      }
                      className="w-16 min-h-9 rounded-app border-2 border-navy/10 bg-white px-2 text-sm text-center"
                    />
                    <span className="text-xs text-navy/50">
                      本（{bottle.quantity}本中）を
                    </span>
                    {(["finished", "returned", "disposed"] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        disabled={pending}
                        onClick={() =>
                          startTransition(() =>
                            consumeBottleQuantityAction(bottle.id, consumeQuantity, s)
                          )
                        }
                        className="btn-base px-3 min-h-9 bg-warn/10 border-2 border-warn/30 text-warn text-xs font-bold disabled:opacity-40"
                      >
                        {STATUS_OPTIONS.find((o) => o.value === s)?.label}に
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
            {STATUS_OPTIONS.filter((o) => o.value !== bottle.status).map((o) => (
              <button
                key={o.value}
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(() => setBottleStatusAction(bottle.id, o.value))
                }
                className="btn-base px-3 min-h-11 bg-white border-2 border-navy/10 text-navy/60 text-sm disabled:opacity-40"
              >
                {bottle.quantity > 1 ? "全部" : ""}
                {o.label}に変更
              </button>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
