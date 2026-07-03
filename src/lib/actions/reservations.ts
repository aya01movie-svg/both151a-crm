"use server";

import { revalidatePath } from "next/cache";
import {
  createReservation,
  updateReservationStatus,
  type NewReservationInput,
} from "@/lib/data/reservations";
import { toErrorMessage } from "@/lib/error-message";
import { jstLocalToUtcIso } from "@/lib/date";

export type SaveReservationState = {
  error: string | null;
  success: boolean;
};

/**
 * RC2修正: 関数全体をtry/catchで包み、想定外の例外が画面のクラッシュ
 * （真っ白画面）に繋がらないよう、必ず SaveReservationState を返すようにした。
 */
export async function saveReservationAction(
  _prev: SaveReservationState,
  formData: FormData
): Promise<SaveReservationState> {
  try {
    const isNewCustomer = formData.get("is_new_customer") === "1";
    const customerId = String(formData.get("customer_id") ?? "");
    const newCustomerName = String(formData.get("new_customer_name") ?? "").trim();

    if (!isNewCustomer && !customerId) {
      return { error: "代表者を選択してください。", success: false };
    }

    const companionNames = formData
      .getAll("companion_names")
      .map((v) => String(v).trim());
    const companionKanas = formData
      .getAll("companion_kanas")
      .map((v) => String(v).trim());
    const tagIds = formData.getAll("tag_ids").map((v) => String(v));

    const rawReservedAt = String(formData.get("reserved_at") ?? "").trim();

    const input: NewReservationInput = {
      customerId,
      isNewCustomer,
      newCustomerName: newCustomerName || undefined,
      reservedAt: rawReservedAt ? jstLocalToUtcIso(rawReservedAt) : "",
      peopleCount: Number(formData.get("people_count") ?? 1),
      companionNames,
      companionKanas,
      bottlePlan: formData.get("bottle_plan") === "1",
      tagIds,
      memo: String(formData.get("memo") ?? "").trim() || null,
    };

    if (!input.reservedAt) {
      return { error: "予約日時を入力してください。", success: false };
    }

    await createReservation(input);

    revalidatePath("/reservations");
    return { error: null, success: true };
  } catch (e) {
    return {
      error: toErrorMessage(e, "保存できませんでした。もう一度お試しください。"),
      success: false,
    };
  }
}

export async function cancelReservationAction(reservationId: string) {
  try {
    await updateReservationStatus(reservationId, "cancelled");
    revalidatePath("/reservations");
  } catch {
    // キャンセル操作の失敗はUI側で目立たせる必要が薄いため静かに無視する
    // （再度キャンセルボタンを押せば再試行できる）
  }
}
