import { requireAdminOrResponse } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import { toCsv, csvResponse } from "@/lib/csv";
import { formatDate } from "@/lib/date";

const STATUS_LABEL: Record<string, string> = {
  kept: "預かり中",
  finished: "飲み切り",
  returned: "返却",
  disposed: "廃棄",
};

export async function GET() {
  const { response } = await requireAdminOrResponse();
  if (response) return response;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bottles")
    .select("*, customers(display_name)")
    .order("expiry_date", { ascending: true });

  if (error) return new Response(error.message, { status: 500 });

  const rows = (
    (data ?? []) as unknown as {
      customers: { display_name: string } | null;
      bottle_type: string | null;
      bottle_name: string;
      quantity: number;
      start_date: string;
      expiry_date: string;
      status: string;
      memo: string | null;
    }[]
  ).map((b) => ({
    customer_name: b.customers?.display_name ?? "",
    bottle_type: b.bottle_type ?? "",
    bottle_name: b.bottle_name,
    quantity: b.quantity,
    start_date: formatDate(b.start_date),
    expiry_date: formatDate(b.expiry_date),
    status: STATUS_LABEL[b.status] ?? b.status,
    memo: b.memo ?? "",
  }));

  const csv = toCsv(rows, [
    { key: "customer_name", label: "顧客名" },
    { key: "bottle_type", label: "種類" },
    { key: "bottle_name", label: "ボトルネーム" },
    { key: "quantity", label: "本数" },
    { key: "start_date", label: "登録日" },
    { key: "expiry_date", label: "期限日" },
    { key: "status", label: "状態" },
    { key: "memo", label: "メモ" },
  ]);

  return csvResponse(csv, `bottles_${new Date().toISOString().slice(0, 10)}.csv`);
}
