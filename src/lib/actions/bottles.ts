"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { toErrorMessage } from "@/lib/error-message";
import type { BottleStatus } from "@/types/database";

export type BottleFormState = { error: string | null };
const ok: BottleFormState = { error: null };

/** ボトル新規預かり登録（顧客詳細の「ボトル追加」から呼び出す・第11章）。 */
export async function addBottleAction(
  _prev: BottleFormState,
  formData: FormData
): Promise<BottleFormState> {
  const customerId = String(formData.get("customer_id") ?? "");
  const bottleType = String(formData.get("bottle_type") ?? "").trim();
  const bottleName = String(formData.get("bottle_name") ?? "").trim();
  const quantity = Number(formData.get("quantity") ?? 1) || 1;
  const expiryDate = String(formData.get("expiry_date") ?? "").trim();
  const memo = String(formData.get("memo") ?? "").trim();

  if (!customerId) return { error: "顧客情報が不正です。" };
  if (!bottleType && !bottleName) return { error: "ボトルの種類またはボトルネームを入力してください。" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("bottles").insert({
    customer_id: customerId,
    bottle_type: bottleType || null,
    bottle_name: bottleName || bottleType,
    quantity,
    expiry_date: expiryDate || undefined,
    memo: memo || null,
    created_by: user?.id ?? null,
  });
  if (error) return { error: toErrorMessage(error, "保存できませんでした。もう一度お試しください。") };

  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/bottles");
  return ok;
}

/** ワンタップ期限延長（第12章：+30日/+90日/+180日）。 */
export async function extendBottleAction(bottleId: string, days: number) {
  const supabase = await createClient();

  const { data: bottle, error: fetchError } = await supabase
    .from("bottles")
    .select("expiry_date, customer_id")
    .eq("id", bottleId)
    .single();
  if (fetchError || !bottle) throw new Error("ボトルが見つかりませんでした。");

  const next = new Date(bottle.expiry_date);
  next.setDate(next.getDate() + days);
  const nextStr = next.toISOString().slice(0, 10);

  const { error } = await supabase
    .from("bottles")
    .update({ expiry_date: nextStr })
    .eq("id", bottleId);
  if (error) throw new Error("期限の更新に失敗しました。");

  revalidatePath("/bottles");
  revalidatePath(`/customers/${bottle.customer_id}`);
}

/** 期限の自由入力変更（第12章）。 */
export async function setBottleExpiryAction(bottleId: string, expiryDate: string) {
  const supabase = await createClient();
  const { data: bottle, error } = await supabase
    .from("bottles")
    .update({ expiry_date: expiryDate })
    .eq("id", bottleId)
    .select("customer_id")
    .single();
  if (error) throw new Error("期限の更新に失敗しました。");

  revalidatePath("/bottles");
  if (bottle) revalidatePath(`/customers/${bottle.customer_id}`);
}

/**
 * 複数本のうち指定本数だけ状態変更する（レビュー指摘⑤→⑧：本数を指定できるように）。
 * 元の行の本数を指定数だけ減らし、対象状態（飲み切り/返却/廃棄）で
 * 新しい行をその本数分作成する。期限管理は残っている（预かり中の）本数のみを対象にする。
 */
export async function consumeBottleQuantityAction(
  bottleId: string,
  consumedQuantity: number,
  resultStatus: Exclude<BottleStatus, "kept">
) {
  const supabase = await createClient();

  const { data: bottle, error: fetchError } = await supabase
    .from("bottles")
    .select("*")
    .eq("id", bottleId)
    .single();
  if (fetchError || !bottle) throw new Error("ボトルが見つかりませんでした。");

  const amount = Math.max(1, Math.min(consumedQuantity, bottle.quantity));

  if (amount >= bottle.quantity) {
    const { error } = await supabase
      .from("bottles")
      .update({ status: resultStatus })
      .eq("id", bottleId);
    if (error) throw new Error(toErrorMessage(error, "状態の更新に失敗しました。"));
  } else {
    const { error: updateError } = await supabase
      .from("bottles")
      .update({ quantity: bottle.quantity - amount })
      .eq("id", bottleId);
    if (updateError) throw new Error(toErrorMessage(updateError, "本数の更新に失敗しました。"));

    const { error: insertError } = await supabase.from("bottles").insert({
      customer_id: bottle.customer_id,
      bottle_type: bottle.bottle_type,
      bottle_name: bottle.bottle_name,
      quantity: amount,
      start_date: bottle.start_date,
      expiry_date: bottle.expiry_date,
      status: resultStatus,
      memo: bottle.memo,
      created_by: bottle.created_by,
    });
    if (insertError) throw new Error(toErrorMessage(insertError, "履歴の作成に失敗しました。"));
  }

  revalidatePath("/bottles");
  revalidatePath(`/customers/${bottle.customer_id}`);
}

/** @deprecated consumeBottleQuantityAction(bottleId, 1, resultStatus) を使用してください。後方互換のため残しています。 */
export async function consumeOneBottleAction(
  bottleId: string,
  resultStatus: Exclude<BottleStatus, "kept">
) {
  return consumeBottleQuantityAction(bottleId, 1, resultStatus);
}
export async function setBottleStatusAction(bottleId: string, status: BottleStatus) {
  const supabase = await createClient();
  const { data: bottle, error } = await supabase
    .from("bottles")
    .update({ status })
    .eq("id", bottleId)
    .select("customer_id")
    .single();
  if (error) throw new Error("状態の更新に失敗しました。");

  revalidatePath("/bottles");
  if (bottle) revalidatePath(`/customers/${bottle.customer_id}`);
}
