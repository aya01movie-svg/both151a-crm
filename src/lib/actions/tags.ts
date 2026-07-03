"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { toErrorMessage } from "@/lib/error-message";

export type TagFormState = { error: string | null };

/** タグ新規作成（第8章。RC5でスタッフ全員に開放。削除・改名は引き続き管理者限定）。 */
export async function createTagAction(
  _prev: TagFormState,
  formData: FormData
): Promise<TagFormState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "タグ名を入力してください。" };

  const supabase = await createClient();
  const { error } = await supabase.from("tags").insert({ name });

  if (error) {
    if (error.code === "23505") return { error: "同じ名前のタグが既に存在します。" };
    return { error: toErrorMessage(error, "保存できませんでした。") };
  }

  revalidatePath("/settings");
  return { error: null };
}

/**
 * 来店登録画面からその場でタグを作成する（第8章レビュー指摘12）。
 * 作成したタグをそのまま選択状態にできるよう、IDと名前を返す。
 */
export async function createTagQuick(name: string): Promise<{ id: string; name: string }> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("タグ名を入力してください。");

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("tags")
    .select("id, name")
    .eq("name", trimmed)
    .maybeSingle();
  if (existing) return existing;

  const { data, error } = await supabase
    .from("tags")
    .insert({ name: trimmed })
    .select("id, name")
    .single();

  if (error) {
    throw new Error(toErrorMessage(error, "タグを追加できませんでした。"));
  }

  revalidatePath("/settings");
  revalidatePath("/visits/new");
  return data;
}

/** タグ削除（管理者のみ）。既存の来店・顧客への紐付けは customer_tags から自動的に外れる。 */
export async function deleteTagAction(tagId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("tags").delete().eq("id", tagId);
  if (error) throw new Error(toErrorMessage(error, "管理者アカウントでのみタグを削除できます。"));
  revalidatePath("/settings");
}
