import { requireAdminOrResponse } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import { toCsv, csvResponse } from "@/lib/csv";
import { formatDateTime } from "@/lib/date";

const STATUS_LABEL: Record<string, string> = {
  reserved: "予約",
  visited: "来店済",
  cancelled: "キャンセル",
};

export async function GET() {
  const { response } = await requireAdminOrResponse();
  if (response) return response;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reservations")
    .select("*, customers(display_name)")
    .order("reserved_at", { ascending: false })
    .limit(5000);

  if (error) return new Response(error.message, { status: 500 });

  const rows = (
    (data ?? []) as unknown as {
      reserved_at: string;
      customers: { display_name: string } | null;
      people_count: number;
      bottle_plan: boolean;
      status: string;
      memo: string | null;
    }[]
  ).map((r) => ({
    reserved_at: formatDateTime(r.reserved_at),
    customer_name: r.customers?.display_name ?? "",
    people_count: r.people_count,
    bottle_plan: r.bottle_plan ? "○" : "",
    status: STATUS_LABEL[r.status] ?? r.status,
    memo: r.memo ?? "",
  }));

  const csv = toCsv(rows, [
    { key: "reserved_at", label: "予約日時" },
    { key: "customer_name", label: "代表者" },
    { key: "people_count", label: "人数" },
    { key: "bottle_plan", label: "ボトル予定" },
    { key: "status", label: "状態" },
    { key: "memo", label: "メモ" },
  ]);

  return csvResponse(csv, `reservations_${new Date().toISOString().slice(0, 10)}.csv`);
}
