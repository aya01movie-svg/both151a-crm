import { createClient } from "@/lib/supabase/server";
import type { Customer, Visit, Tag, PaymentMethod, SeatType } from "@/types/database";
import { toErrorMessage } from "@/lib/error-message";

/**
 * 顧客名オートコンプリート（第5章）。
 * display_name / kana の前方一致寄りの部分一致で高速に候補を返す。
 * trigramインデックス（003）を利用するため500件規模でも十分高速。
 */
export async function searchCustomerNames(
  query: string,
  limit = 8
): Promise<Pick<Customer, "id" | "display_name" | "kana" | "caution_level">[]> {
  if (!query.trim()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("id, display_name, kana, caution_level")
    .eq("hidden", false)
    .or(`display_name.ilike.%${query}%,kana.ilike.%${query}%`)
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export type LastVisitInfo = {
  seat_type: SeatType | null;
  payment_method: PaymentMethod;
  receipt_required: boolean;
  receipt_name: string | null;
  tags: Tag[];
  companionNames: string[];
  memo: string | null;
  hasHistory: boolean;
};

/**
 * 既存顧客の「来店」ボタンから開いた場合の前回情報自動入力（第4章・第5章・第19章）。
 * 前回タグ・前回領収書宛名・前回同伴者・前回メモを取得する。
 * 会計金額・チップは毎回変わるため引き継がない（レビュー指摘：前回来店コピー）。
 *
 * RC8修正: 代表者としての来店だけでなく、同伴者として来店した履歴も
 * 「前回来店」の候補に含める（どちらの立場でも、より新しい方を採用する）。
 * ボトルは来店登録から切り離したため、ここでは扱わない。
 */
export async function getLastVisitInfo(
  customerId: string
): Promise<LastVisitInfo | null> {
  const supabase = await createClient();

  const [primaryVisitRes, companionVisitRes, tagsRes] = await Promise.all([
    supabase
      .from("visits")
      .select("*")
      .eq("primary_customer_id", customerId)
      .eq("invalidated", false)
      .order("visited_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("visit_members")
      .select("visits(*)")
      .eq("customer_id", customerId)
      .eq("member_type", "companion")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("customer_tags")
      .select("tags(*)")
      .eq("customer_id", customerId),
  ]);

  const primaryVisit = primaryVisitRes.data as Visit | null;

  // 同伴者としての来店候補から、無効化されていないもののうち最新の1件を選ぶ
  const companionVisitCandidates = (
    (companionVisitRes.data ?? []) as unknown as { visits: Visit | null }[]
  )
    .map((row) => row.visits)
    .filter((v): v is Visit => !!v && !v.invalidated)
    .sort((a, b) => (a.visited_at < b.visited_at ? 1 : -1));
  const companionVisit = companionVisitCandidates[0] ?? null;

  // 代表者としての来店・同伴者としての来店のうち、より新しい方を「前回来店」として採用する
  const lastVisit =
    !primaryVisit && !companionVisit
      ? null
      : !primaryVisit
      ? companionVisit
      : !companionVisit
      ? primaryVisit
      : primaryVisit.visited_at >= companionVisit.visited_at
      ? primaryVisit
      : companionVisit;

  const tags = ((tagsRes.data ?? []) as unknown as { tags: Tag }[])
    .map((r) => r.tags)
    .filter(Boolean);

  let companionNames: string[] = [];
  if (lastVisit) {
    const { data: members } = await supabase
      .from("visit_members")
      .select("customers(display_name)")
      .eq("visit_id", lastVisit.id)
      .eq("member_type", "companion");
    companionNames = ((members ?? []) as unknown as { customers: { display_name: string } | null }[])
      .map((m) => m.customers?.display_name)
      .filter((n): n is string => !!n);
  }

  return {
    seat_type: lastVisit?.seat_type ?? null,
    payment_method: lastVisit?.payment_method ?? "cash",
    receipt_required: lastVisit?.receipt_required ?? false,
    receipt_name: lastVisit?.receipt_name ?? null,
    tags,
    companionNames,
    memo: lastVisit?.memo ?? null,
    hasHistory: !!lastVisit,
  };
}

export type NewVisitInput = {
  customerId: string;
  isNewCustomer: boolean;
  newCustomerName?: string;
  newCustomerKana?: string;
  visitedAt: string; // ISO文字列
  peopleCount: number;
  companionNames: string[]; // 最大10名（第4章）
  companionKanas: string[]; // companionNamesと同じ並び順（レビュー指摘⑨）
  amount: number;
  tip: number;
  paymentMethod: PaymentMethod;
  seatType: SeatType | null;
  receiptRequired: boolean;
  receiptName: string | null;
  tagIds: string[];
  memo: string | null;
  /** 予約からの引き継ぎの場合、来店登録完了と同時に予約を「来店済」にする（第10章） */
  reservationId?: string | null;
};

/**
 * 来店登録の保存（第4章・第18章・第30章）。
 *
 * RC8修正: 保存安定性を最優先するため、ボトル・シャンパンの保存を
 * 来店登録の保存処理から完全に切り離した。ボトルは顧客詳細の
 * 「ボトル追加」からのみ登録する（従来から安定して動作している経路）。
 * これにより来店登録の保存処理は「顧客・来店・同伴者・タグ・予約更新」の
 * 1トランザクションのみとなり、失敗要因を大幅に減らしている。
 */
export async function createVisit(input: NewVisitInput) {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("create_visit_with_details", {
    p_customer_id: input.isNewCustomer ? null : input.customerId,
    p_is_new_customer: input.isNewCustomer,
    p_new_customer_name: input.newCustomerName ?? null,
    p_visited_at: input.visitedAt,
    p_people_count: input.peopleCount,
    p_companion_names: input.companionNames,
    p_amount: input.amount,
    p_tip: input.tip,
    p_payment_method: input.paymentMethod,
    p_seat_type: input.seatType,
    p_receipt_required: input.receiptRequired,
    p_receipt_name: input.receiptName,
    p_memo: input.memo,
    p_tag_ids: input.tagIds,
    p_reservation_id: input.reservationId ?? null,
    p_new_customer_kana: input.newCustomerKana ?? null,
    p_companion_kanas: input.companionKanas,
  });

  if (error) {
    throw new Error(toErrorMessage(error, "保存できませんでした。もう一度お試しください。"));
  }

  const result = data as unknown as { visit_id?: string; customer_id?: string };

  if (!result?.customer_id || !result?.visit_id) {
    throw new Error(
      "来店の保存中にIDの取得に失敗しました。もう一度お試しください（改善しない場合はご連絡ください）。"
    );
  }

  return { visitId: result.visit_id, customerId: result.customer_id };
}
