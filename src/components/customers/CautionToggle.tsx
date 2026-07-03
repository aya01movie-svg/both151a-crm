"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Ban } from "lucide-react";
import { setCautionAction } from "@/lib/actions/customers";
import type { CautionLevel } from "@/types/database";

const LEVEL_META: Record<
  CautionLevel,
  { label: string; badgeClass: string }
> = {
  none: { label: "通常", badgeClass: "bg-navy/5 text-navy/40" },
  caution: { label: "⚠️ 注意", badgeClass: "bg-warn/15 text-warn" },
  banned: { label: "⛔ 出禁", badgeClass: "bg-danger/15 text-danger" },
};

export function CautionToggle({
  customerId,
  level,
  reason,
  registeredAt,
  registeredByName,
}: {
  customerId: string;
  level: CautionLevel;
  reason: string | null;
  registeredAt: string | null;
  registeredByName: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [pickingLevel, setPickingLevel] = useState<"caution" | "banned" | null>(null);
  const [reasonInput, setReasonInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(next: CautionLevel, reasonText: string | null) {
    setError(null);
    startTransition(async () => {
      try {
        await setCautionAction(customerId, next, reasonText);
        setPickingLevel(null);
        setReasonInput("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "変更に失敗しました。");
      }
    });
  }

  return (
    <div className="rounded-app border-2 border-navy/10 p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className={`text-xs font-bold rounded-full px-2.5 py-1 ${LEVEL_META[level].badgeClass}`}>
          {LEVEL_META[level].label}
        </span>
        {level !== "none" && (
          <button
            type="button"
            disabled={pending}
            onClick={() => submit("none", null)}
            className="text-xs text-navy/40 underline disabled:opacity-40"
          >
            解除する
          </button>
        )}
      </div>

      {level !== "none" && reason && (
        <div className="text-xs text-navy/60 bg-beige rounded-app p-2 mb-2 whitespace-pre-wrap">
          <p className="font-bold">
            理由：{reason}
          </p>
          {registeredAt && (
            <p className="text-navy/40 mt-1">
              登録日：{new Date(registeredAt).toLocaleDateString("ja-JP")}
              {registeredByName ? `・登録者：${registeredByName}` : ""}
            </p>
          )}
        </div>
      )}

      {pickingLevel ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={reasonInput}
            onChange={(e) => setReasonInput(e.target.value)}
            rows={2}
            placeholder={pickingLevel === "banned" ? "出禁理由" : "注意理由"}
            className="w-full rounded-app border-2 border-navy/10 bg-white px-3 py-2 text-sm text-navy focus:outline-none focus:border-gold"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => submit(pickingLevel, reasonInput.trim() || null)}
              className="btn-base flex-1 min-h-10 bg-danger text-white text-sm disabled:opacity-50"
            >
              {pending ? "保存中…" : "保存する"}
            </button>
            <button
              type="button"
              onClick={() => setPickingLevel(null)}
              className="btn-base flex-1 min-h-10 bg-white border-2 border-navy/10 text-navy/60 text-sm"
            >
              キャンセル
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => setPickingLevel("caution")}
            className="btn-base flex-1 min-h-10 bg-warn/10 text-warn border-2 border-warn/30 text-xs font-bold disabled:opacity-50 inline-flex items-center justify-center gap-1"
          >
            <AlertTriangle size={14} /> 注意にする
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setPickingLevel("banned")}
            className="btn-base flex-1 min-h-10 bg-danger/10 text-danger border-2 border-danger/30 text-xs font-bold disabled:opacity-50 inline-flex items-center justify-center gap-1"
          >
            <Ban size={14} /> 出禁にする
          </button>
        </div>
      )}
      {error && <p className="text-danger text-xs font-bold mt-2">{error}</p>}
    </div>
  );
}
