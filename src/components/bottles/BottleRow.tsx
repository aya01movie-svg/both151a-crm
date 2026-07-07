"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  setBottleStatusAction,
  consumeBottleQuantityAction,
} from "@/lib/actions/bottles";
import { Card } from "@/components/ui/Card";
import { formatDate } from "@/lib/date";
import type { BottleWithCustomer } from "@/lib/data/bottles";
import type { BottleStatus } from "@/types/database";

const STATUS_OPTIONS: { value: BottleStatus; label: string }[] = [
  { value: "kept",     label: "預かり中" },
  { value: "finished", label: "飲み切り" },
  { value: "returned", label: "返却" },
  { value: "disposed", label: "廃棄" },
];

const STATUS_LABEL: Record<string, string> = {
  kept:     "🍷 預かり中",
  finished: "飲み切り済",
  returned: "返却済",
  disposed: "廃棄済",
};

export function BottleRow({ bottle }: { bottle: BottleWithCustomer }) {
  const [editing, setEditing] = useState(false);
  const [partialConsumeOpen, setPartialConsumeOpen] = useState(false);
  const [consumeQuantity, setConsumeQuantity] = useState(1);
  const [pending, startTransition] = useTransition();

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <Link
            href={`/customers/${bottle.customer_id}`}
            className="font-bold text-navy text-base hover:underline"
          >
            {bottle.customer_display_name}
          </Link>
          <span className="text-navy/70 ml-2 text-sm">
            {bottle.bottle_type && <span className="font-bold">{bottle.bottle_type}</span>}
            {bottle.bottle_type && bottle.bottle_name && bottle.bottle_name !== bottle.bottle_type && (
              <span className="text-navy/40">（{bottle.bottle_name}）</span>
            )}
            {!bottle.bottle_type && bottle.bottle_name}
            {bottle.quantity > 1 && <span className="text-navy/40 text-xs ml-1">×{bottle.quantity}</span>}
          </span>
          <p className="text-xs text-navy/40 mt-0.5">
            登録：{formatDate(bottle.start_date)}　状態：{STATUS_LABEL[bottle.status] ?? bottle.status}
          </p>
          {bottle.companion_names && bottle.companion_names.length > 0 && (
            <p className="text-xs font-bold text-info mt-1 bg-info/5 rounded px-1.5 py-0.5 inline-block">
              👥 同伴：{bottle.companion_names.join("、")}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {bottle.status === "kept" && (
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className="btn-base px-4 min-h-11 bg-navy text-white text-sm"
            >
              状態変更
            </button>
          )}
        </div>
      </div>

      {/* 状態変更パネル */}
      {editing && (
        <div className="flex flex-wrap items-start gap-3 border-t border-navy/10 pt-3">
          {/* 一部消費 */}
          {bottle.quantity > 1 && bottle.status === "kept" && (
            <div className="w-full flex flex-wrap items-center gap-2 bg-warn/5 rounded-app p-3">
              <label className="flex items-center gap-2 text-sm font-bold text-navy/60 w-full">
                <input
                  type="checkbox"
                  checked={partialConsumeOpen}
                  onChange={(e) => setPartialConsumeOpen(e.target.checked)}
                  className="w-4 h-4 accent-warn"
                />
                一部だけ変更する（{bottle.quantity}本中）
              </label>
              {partialConsumeOpen && (
                <div className="flex flex-wrap items-center gap-2">
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
                    className="w-16 min-h-10 rounded-app border-2 border-navy/10 bg-white px-2 text-sm text-center"
                  />
                  <span className="text-sm text-navy/50">本を</span>
                  {(["finished", "returned", "disposed"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        startTransition(() => consumeBottleQuantityAction(bottle.id, consumeQuantity, s))
                      }
                      className="btn-base px-3 min-h-10 bg-warn/10 border-2 border-warn/30 text-warn text-sm font-bold disabled:opacity-40"
                    >
                      {STATUS_OPTIONS.find((o) => o.value === s)?.label}に
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 全部変更 */}
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.filter((o) => o.value !== bottle.status).map((o) => (
              <button
                key={o.value}
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(() => setBottleStatusAction(bottle.id, o.value))
                }
                className="btn-base px-4 min-h-11 bg-white border-2 border-navy/10 text-navy/60 text-sm disabled:opacity-40"
              >
                {bottle.quantity > 1 ? "全部 " : ""}
                {o.label}に変更
              </button>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
