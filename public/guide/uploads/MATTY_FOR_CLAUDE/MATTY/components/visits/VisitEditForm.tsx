"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateVisitAction, invalidateVisitAction } from "@/lib/actions/visits";
import { initialUpdateVisitState } from "@/lib/actions/visits-state";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { toDateTimeLocalValue } from "@/lib/date";
import type { VisitEditDetail } from "@/lib/data/visits";

/**
 * 来店登録の入力ミス修正フォーム。
 * 「来店登録を間違えた時に修正できない」というご要望への対応。
 * 同伴者・タグ・顧客の変更は対象外（会計・日時など基本項目のみ）。
 */
export function VisitEditForm({ visit }: { visit: VisitEditDetail }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    updateVisitAction,
    initialUpdateVisitState
  );
  const [invalidating, startInvalidateTransition] = useTransition();

  const [visitedAt, setVisitedAt] = useState(toDateTimeLocalValue(new Date(visit.visited_at)));
  const [amount, setAmount] = useState(String(visit.amount));
  const [tip, setTip] = useState(String(visit.tip));
  const [paymentMethod, setPaymentMethod] = useState(visit.payment_method);
  const [seatType, setSeatType] = useState<string>(visit.seat_type ?? "");
  const [receiptRequired, setReceiptRequired] = useState(visit.receipt_required);
  const [receiptName, setReceiptName] = useState(visit.receipt_name ?? "");
  const [memo, setMemo] = useState(visit.memo ?? "");

  useEffect(() => {
    if (state.success && state.customerId) {
      router.push(`/customers/${state.customerId}`);
    }
  }, [state.success, state.customerId, router]);

  function handleInvalidate() {
    if (!confirm("この来店登録を無効化しますか？（記録は残りますが、集計・一覧から除外されます。削除ではありません）")) return;
    startInvalidateTransition(async () => {
      await invalidateVisitAction(visit.id, visit.primary_customer_id);
      router.push(`/customers/${visit.primary_customer_id}`);
    });
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="visit_id" value={visit.id} />

      <Card>
        <CardTitle>来店を修正</CardTitle>
        <p className="text-sm text-navy/50 mb-4">
          {visit.customerName} さんの来店記録を修正します。
          同伴者・タグを変更したい場合はお手数ですが一度削除（無効化）し、
          あらためて来店登録をお願いします。
        </p>

        <div className="flex flex-col gap-4">
          <label className="block">
            <span className="block text-sm font-bold text-navy/70 mb-1.5">来店日時</span>
            <input
              type="datetime-local"
              name="visited_at"
              value={visitedAt}
              onChange={(e) => setVisitedAt(e.target.value)}
              required
              className="w-full min-h-14 rounded-app border-2 border-navy/10 bg-white px-4 text-base text-navy focus:outline-none focus:border-gold"
            />
          </label>

          <label className="block">
            <span className="block text-sm font-bold text-navy/70 mb-1.5">会計金額</span>
            <input
              type="number"
              name="amount"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="w-full min-h-14 rounded-app border-2 border-navy/10 bg-white px-4 text-base text-navy focus:outline-none focus:border-gold"
            />
          </label>

          <label className="block">
            <span className="block text-sm font-bold text-navy/70 mb-1.5">チップ</span>
            <input
              type="number"
              name="tip"
              min={0}
              value={tip}
              onChange={(e) => setTip(e.target.value)}
              className="w-full min-h-14 rounded-app border-2 border-navy/10 bg-white px-4 text-base text-navy focus:outline-none focus:border-gold"
            />
          </label>

          <div>
            <span className="block text-sm font-bold text-navy/70 mb-1.5">支払い方法</span>
            <input type="hidden" name="payment_method" value={paymentMethod} />
            <div className="grid grid-cols-3 gap-2">
              {(["cash", "credit", "other"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setPaymentMethod(v)}
                  className={`btn-base border-2 transition-colors ${
                    paymentMethod === v
                      ? "bg-navy text-white border-navy"
                      : "bg-white text-navy border-navy/10 active:bg-navy/5"
                  }`}
                >
                  {v === "cash" ? "現金" : v === "credit" ? "クレジット" : "その他"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="block text-sm font-bold text-navy/70 mb-1.5">席タイプ</span>
            <input type="hidden" name="seat_type" value={seatType} />
            <div className="grid grid-cols-2 gap-2">
              {([{ v: "counter", l: "カウンター" }, { v: "box", l: "BOX" }] as const).map(({ v, l }) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setSeatType(seatType === v ? "" : v)}
                  className={`btn-base border-2 transition-colors ${
                    seatType === v
                      ? "bg-navy text-white border-navy"
                      : "bg-white text-navy border-navy/10 active:bg-navy/5"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 min-h-12">
              <input
                type="checkbox"
                name="receipt_required"
                value="1"
                checked={receiptRequired}
                onChange={(e) => setReceiptRequired(e.target.checked)}
                className="w-5 h-5 accent-gold"
              />
              <span className="font-bold text-navy/70 text-sm">領収書が必要</span>
            </label>
            {receiptRequired && (
              <input
                type="text"
                name="receipt_name"
                value={receiptName}
                onChange={(e) => setReceiptName(e.target.value)}
                placeholder="宛名（必須）"
                required
                className="w-full min-h-12 rounded-app border-2 border-navy/10 bg-white px-4 text-base text-navy focus:outline-none focus:border-gold mt-1"
              />
            )}
          </div>

          <label className="block">
            <span className="block text-sm font-bold text-navy/70 mb-1.5">メモ</span>
            <textarea
              name="memo"
              rows={3}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="w-full rounded-app border-2 border-navy/10 bg-white px-4 py-3 text-base text-navy focus:outline-none focus:border-gold"
            />
          </label>

          {state.error && (
            <p role="alert" className="text-danger text-sm font-bold">
              {state.error}
            </p>
          )}

          <div className="flex gap-3">
            <Button type="submit" variant="navy" fullWidth disabled={pending}>
              {pending ? "保存中…" : "修正を保存"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(`/customers/${visit.primary_customer_id}`)}
              disabled={pending}
            >
              キャンセル
            </Button>
          </div>
        </div>
      </Card>

      <Card className="border-2 border-dashed border-danger/30">
        <CardTitle className="text-danger">この来店登録を無効化</CardTitle>
        <p className="text-sm text-navy/50 mb-3">
          誤って登録してしまった来店（人違い・重複登録など）はこちらから無効化できます。
          記録は残りますが、以後の集計や一覧には表示されなくなります（削除ではありません）。
        </p>
        <button
          type="button"
          onClick={handleInvalidate}
          disabled={invalidating}
          className="text-danger underline text-sm font-bold disabled:opacity-40"
        >
          {invalidating ? "処理中…" : "この来店を無効化する"}
        </button>
      </Card>
    </form>
  );
}
