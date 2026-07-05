"use server";

import { revalidatePath } from "next/cache";
import { searchCustomerNames, createVisit, getLastVisitInfo, type NewVisitInput } from "@/lib/data/visits";
import { toErrorMessage } from "@/lib/error-message";
import { jstLocalToUtcIso } from "@/lib/date";
import type { SaveVisitState } from "./visits-state";

/** 顧客名オートコンプリート用（第5章）。クライアントからデバウンスして呼び出す。 */
export async function searchCustomersAction(query: string) {
  try {
    return await searchCustomerNames(query, 8);
  } catch {
    return [];
  }
}

/** 前回来店をコピーするボタンから呼び出す（レビュー指摘：前回来店コピー）。 */
export async function getLastVisitInfoAction(customerId: string) {
  return getLastVisitInfo(customerId);
}

/**
 * 来店登録の保存（第4章・第29章）。
 * 「保存」→顧客詳細へ遷移、「保存して続ける」→フォームをクリアして同画面継続、
 * という分岐はクライアント側（VisitForm）で intent を見て行う。
 *
 * RC8修正: 保存安定性を最優先し、ボトル・シャンパンの入力・保存処理を
 * 来店登録から完全に削除した（顧客詳細の「ボトル追加」からのみ登録する）。
 * これにより来店登録の保存は「顧客・来店・同伴者・タグ・予約更新」のみを
 * 1トランザクションで行うシンプルな処理となった。
 *
 * v1.1修正: 保存成功後にホーム/カレンダー等のキャッシュを明示的に無効化し、
 * 本番環境で集計・カレンダー表示が更新されない不具合を修正した。
 * また、来店登録から新規顧客を作成する場合も誕生日を入力できるようにした。
 */
export async function saveVisitAction(
  _prevState: SaveVisitState,
  formData: FormData
): Promise<SaveVisitState> {
  let intent: "save" | "save_and_continue" = "save";

  try {
    intent = String(formData.get("intent") ?? "save") as "save" | "save_and_continue";

    const isNewCustomer = formData.get("is_new_customer") === "1";
    const customerId = String(formData.get("customer_id") ?? "");
    const newCustomerName = String(formData.get("new_customer_name") ?? "").trim();
    const newCustomerKana = String(formData.get("new_customer_kana") ?? "").trim();
    const newCustomerBirthday = String(formData.get("new_customer_birthday") ?? "").trim();

    if (!isNewCustomer && !customerId) {
      return { error: "代表者を選択してください。", success: false, customerId: null, intent };
    }

    const companionNames = formData
      .getAll("companion_names")
      .map((v) => String(v).trim());
    const companionKanas = formData
      .getAll("companion_kanas")
      .map((v) => String(v).trim());

    const tagIds = formData.getAll("tag_ids").map((v) => String(v));
    const receiptRequired = formData.get("receipt_required") === "1";

    const input: NewVisitInput = {
      customerId,
      isNewCustomer,
      newCustomerName: newCustomerName || undefined,
      newCustomerKana: newCustomerKana || undefined,
      newCustomerBirthday: newCustomerBirthday || undefined,
      visitedAt: (() => {
        const raw = String(formData.get("visited_at") ?? "").trim();
        return raw ? jstLocalToUtcIso(raw) : new Date().toISOString();
      })(),
      peopleCount: Number(formData.get("people_count") ?? 1),
      companionNames,
      companionKanas,
      amount: Number(formData.get("amount") ?? 0),
      tip: Number(formData.get("tip") ?? 0),
      paymentMethod: String(formData.get("payment_method") ?? "cash") as NewVisitInput["paymentMethod"],
      seatType: (String(formData.get("seat_type") ?? "") || null) as NewVisitInput["seatType"],
      receiptRequired,
      receiptName: receiptRequired ? String(formData.get("receipt_name") ?? "").trim() || null : null,
      tagIds,
      memo: String(formData.get("memo") ?? "").trim() || null,
      reservationId: String(formData.get("reservation_id") ?? "") || null,
    };

    const result = await createVisit(input);

    // v1.1修正: ホーム・カレンダー・顧客詳細・顧客一覧のキャッシュを確実に無効化する
    revalidatePath("/dashboard");
    revalidatePath("/calendar");
    revalidatePath("/customers");
    revalidatePath(`/customers/${result.customerId}`);
    revalidatePath("/reservations");

    return {
      error: null,
      success: true,
      customerId: result.customerId,
      intent,
    };
  } catch (e) {
    return {
      error: toErrorMessage(e, "保存できませんでした。もう一度お試しください。"),
      success: false,
      customerId: null,
      intent,
    };
  }
}
