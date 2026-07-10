import { createClient } from "@/lib/supabase/server";
import type { Reservation, ReservationStatus } from "@/types/database";
import { toErrorMessage } from "@/lib/error-message";

export type ReservationWithCustomer = Reservation & {
  customer_display_name: string;
  customer_caution_level: "none" | "caution" | "banned";
  companion_names: string[];
};

/**
 * 予約一覧（第10章・第28章）。
 * RC2修正: 本日の予約に加え、明日以降の今後の予約も日付順に表示する。
 * ステータス（予約中/来店済み/キャンセル）はすべて表示対象とし、
 * フィルタで隠さずバッジで区別できるようにする。
 */
export async function listReservations(): Promise<{
  today: ReservationWithCustomer[];
  upcoming: ReservationWithCustomer[];
}> {
  const supabase = await createClient();

  const now = new Date();
  const todayStart = now.toISOString().slice(0, 10);
  const todayEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  // 今後60日分を対象とする（営業中に数日先まで見通せるように）
  const rangeEnd = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("reservations")
    .select("*")
    .gte("reserved_at", `${todayStart}T00:00:00`)
    .lte("reserved_at", rangeEnd)
    .order("reserved_at", { ascending: true })
    .limit(300);

  if (error) throw error;

  const rows = (data ?? []) as Reservation[];

  // 顧客名・注意レベルを2段クエリで取得
  const resCustIds = [...new Set(rows.map((r) => r.customer_id))];
  const resCustById = new Map<string, { display_name: string; caution_level: "none" | "caution" | "banned" }>();
  if (resCustIds.length > 0) {
    const { data: custData } = await supabase
      .from("customers")
      .select("id, display_name, caution_level")
      .in("id", resCustIds);
    for (const c of (custData ?? []) as { id: string; display_name: string; caution_level: "none" | "caution" | "banned" }[]) {
      resCustById.set(c.id, c);
    }
  }

  const ids = rows.map((r) => r.id);
  const membersByReservation = new Map<string, string[]>();
  if (ids.length > 0) {
    const { data: memberRowsRes } = await supabase
      .from("reservation_members")
      .select("reservation_id, customer_id")
      .in("reservation_id", ids);

    const memberCIds = [...new Set(
      (memberRowsRes ?? []).map((m: { customer_id: string }) => m.customer_id)
    )];
    if (memberCIds.length > 0) {
      const { data: memberCData } = await supabase
        .from("customers")
        .select("id, display_name")
        .in("id", memberCIds);
      const mNameById = new Map(
        (memberCData ?? []).map((c: { id: string; display_name: string }) => [c.id, c.display_name])
      );
      for (const m of (memberRowsRes ?? []) as { reservation_id: string; customer_id: string }[]) {
        const name = mNameById.get(m.customer_id);
        if (!name) continue;
        const list = membersByReservation.get(m.reservation_id) ?? [];
        list.push(name);
        membersByReservation.set(m.reservation_id, list);
      }
    }
  }

  const withCustomer: ReservationWithCustomer[] = rows.map((r) => ({
    ...r,
    customer_display_name: resCustById.get(r.customer_id)?.display_name ?? "",
    customer_caution_level: resCustById.get(r.customer_id)?.caution_level ?? "none",
    companion_names: membersByReservation.get(r.id) ?? [],
  }));

  const today = withCustomer.filter(
    (r) => r.reserved_at >= `${todayStart}T00:00:00` && r.reserved_at < `${todayEnd}T00:00:00`
  );
  const upcoming = withCustomer.filter(
    (r) => r.reserved_at >= `${todayEnd}T00:00:00`
  );

  return { today, upcoming };
}

export type ReservationDetail = {
  reservation: Reservation;
  customerName: string;
  companionNames: string[];
  tagIds: string[];
};

/** 予約→来店登録への引き継ぎ用（第10章）。 */
export async function getReservationDetail(
  reservationId: string
): Promise<ReservationDetail | null> {
  const supabase = await createClient();

  const { data: reservation, error } = await supabase
    .from("reservations")
    .select("*")
    .eq("id", reservationId)
    .single();
  if (error || !reservation) return null;

  const [customerRes, membersRes, tagsRes] = await Promise.all([
    supabase.from("customers").select("display_name").eq("id", reservation.customer_id).single(),
    supabase
      .from("reservation_members")
      .select("customer_id")
      .eq("reservation_id", reservationId),
    supabase.from("customer_tags").select("tag_id").eq("customer_id", reservation.customer_id),
  ]);

  const memberCIds = (membersRes.data ?? []).map((m: { customer_id: string }) => m.customer_id);
  let companionNames: string[] = [];
  if (memberCIds.length > 0) {
    const { data: mcData } = await supabase
      .from("customers")
      .select("id, display_name")
      .in("id", memberCIds);
    companionNames = (mcData ?? []).map((c: { display_name: string }) => c.display_name);
  }

  return {
    reservation: reservation as Reservation,
    customerName: customerRes.data?.display_name ?? "",
    companionNames,
    tagIds: (tagsRes.data ?? []).map((t) => t.tag_id),
  };
}

export type NewReservationInput = {
  customerId: string;
  isNewCustomer: boolean;
  newCustomerName?: string;
  newCustomerKana?: string;
  reservedAt: string;
  peopleCount: number;
  companionNames: string[];
  companionKanas: string[];
  bottlePlan: boolean;
  tagIds: string[];
  memo: string | null;
};

/**
 * 予約登録（第10章・第30章）。
 * RC4修正: 来店登録と同様、複数の個別Supabase呼び出しではなく
 * create_reservation_with_details() DB関数（1トランザクション）にまとめた。
 */
export async function createReservation(input: NewReservationInput) {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("create_reservation_with_details", {
    p_customer_id: input.isNewCustomer ? null : input.customerId,
    p_is_new_customer: input.isNewCustomer,
    p_new_customer_name: input.newCustomerName ?? null,
    p_reserved_at: input.reservedAt,
    p_people_count: input.peopleCount,
    p_companion_names: input.companionNames,
    p_bottle_plan: input.bottlePlan,
    p_tag_ids: input.tagIds,
    p_memo: input.memo,
    p_new_customer_kana: input.newCustomerKana ?? null,
    p_companion_kanas: input.companionKanas,
  });

  if (error) {
    throw new Error(toErrorMessage(error, "保存できませんでした。もう一度お試しください。"));
  }

  const result = data as unknown as { reservation_id: string; customer_id: string };
  return { reservationId: result.reservation_id, customerId: result.customer_id };
}

export async function updateReservationStatus(
  reservationId: string,
  status: ReservationStatus
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("reservations")
    .update({ status })
    .eq("id", reservationId);
  if (error) throw error;
}
