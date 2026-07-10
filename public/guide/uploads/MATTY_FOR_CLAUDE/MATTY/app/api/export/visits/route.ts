import { requireAdminOrResponse } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import { toCsv, csvResponse } from "@/lib/csv";
import { formatDateTime } from "@/lib/date";

const PAYMENT_LABEL: Record<string, string> = {
  cash: "現金",
  credit: "クレジット",
  other: "その他",
};

export async function GET() {
  const { response } = await requireAdminOrResponse();
  if (response) return response;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("visits")
    .select("*, customers(display_name)")
    .order("visited_at", { ascending: false })
    .limit(5000);

  if (error) return new Response(error.message, { status: 500 });

  const rows = (
    (data ?? []) as unknown as {
      visited_at: string;
      customers: { display_name: string } | null;
      people_count: number;
      amount: number;
      tip: number;
      payment_method: string;
      seat_type: string | null;
      receipt_required: boolean;
      receipt_name: string | null;
      memo: string | null;
      invalidated: boolean;
    }[]
  ).map((v) => ({
    visited_at: formatDateTime(v.visited_at),
    customer_name: v.customers?.display_name ?? "",
    people_count: v.people_count,
    amount: v.amount,
    tip: v.tip,
    payment_method: PAYMENT_LABEL[v.payment_method] ?? v.payment_method,
    seat_type: v.seat_type === "counter" ? "カウンター" : v.seat_type === "box" ? "BOX" : "",
    receipt: v.receipt_required ? v.receipt_name ?? "要" : "",
    memo: v.memo ?? "",
    status: v.invalidated ? "無効" : "有効",
  }));

  const csv = toCsv(rows, [
    { key: "visited_at", label: "来店日時" },
    { key: "customer_name", label: "顧客名" },
    { key: "people_count", label: "人数" },
    { key: "amount", label: "会計金額" },
    { key: "tip", label: "チップ" },
    { key: "payment_method", label: "支払い方法" },
    { key: "seat_type", label: "席タイプ" },
    { key: "receipt", label: "領収書宛名" },
    { key: "memo", label: "メモ" },
    { key: "status", label: "状態" },
  ]);

  return csvResponse(csv, `visits_${new Date().toISOString().slice(0, 10)}.csv`);
}
