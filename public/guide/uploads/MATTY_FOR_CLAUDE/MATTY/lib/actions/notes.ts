"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type AddNoteState = {
  error: string | null;
};

/**
 * メモ追加（第23章「メモは編集上書きではなく、追加方式とする」）。
 * 既存メモの更新・削除は行わず、常に新しい行を追加する。
 */
export async function addNoteAction(
  _prevState: AddNoteState,
  formData: FormData
): Promise<AddNoteState> {
  const customerId = String(formData.get("customer_id") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  if (!customerId) return { error: "顧客情報が不正です。" };
  if (!note) return { error: "メモを入力してください。" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("notes")
    .insert({ customer_id: customerId, note, created_by: user?.id ?? null });

  if (error) {
    return { error: "保存できませんでした。もう一度お試しください。" };
  }

  revalidatePath(`/customers/${customerId}`);
  return { error: null };
}

/** メモの無効化（第23章：本文は書き換えず、無効化のみ可能。管理者限定）。 */
export async function invalidateNoteAction(noteId: string, customerId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("notes")
    .update({ invalidated: true })
    .eq("id", noteId);
  if (error) {
    throw new Error("無効化に失敗しました（管理者アカウントか確認してください）。");
  }
  revalidatePath(`/customers/${customerId}`);
}
