import { requireAdminOrResponse } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import { toCsv, csvResponse } from "@/lib/csv";
import { formatDate } from "@/lib/date";

const RANK_LABEL: Record<string, string> = {
  first: "初来店",
  regular: "常連",
  vip: "VIP",
  special: "特別",
};

const CAUTION_LABEL: Record<string, string> = {
  none: "",
  caution: "注意",
  banned: "出禁",
};

export async function GET() {
  const { response } = await requireAdminOrResponse();
  if (response) return response;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("hidden", false)
    .order("display_name", { ascending: true });

  if (error) return new Response(error.message, { status: 500 });

  const rows = (data ?? []).map((c) => ({
    display_name: c.display_name,
    kana: c.kana ?? "",
    real_name: c.real_name ?? "",
    birthday: c.birthday ? formatDate(c.birthday) : "",
    rank: RANK_LABEL[c.rank] ?? c.rank,
    favorite: c.favorite ? "○" : "",
    visit_count: c.visit_count,
    total_amount: c.total_amount,
    total_tip: c.total_tip,
    last_visit_at: c.last_visit_at ? formatDate(c.last_visit_at) : "",
    current_bottle_count: c.current_bottle_count,
    caution: CAUTION_LABEL[c.caution_level] ?? "",
    memo: c.memo ?? "",
  }));

  const csv = toCsv(rows, [
    { key: "display_name", label: "登録名" },
    { key: "kana", label: "ふりがな" },
    { key: "real_name", label: "本名" },
    { key: "birthday", label: "誕生日" },
    { key: "rank", label: "ランク" },
    { key: "favorite", label: "お気に入り" },
    { key: "visit_count", label: "累計来店回数" },
    { key: "total_amount", label: "累計売上" },
    { key: "total_tip", label: "累計チップ" },
    { key: "last_visit_at", label: "最終来店日" },
    { key: "current_bottle_count", label: "現在預かりボトル本数" },
    { key: "caution", label: "注意/出禁" },
    { key: "memo", label: "メモ" },
  ]);

  return csvResponse(csv, `customers_${new Date().toISOString().slice(0, 10)}.csv`);
}
