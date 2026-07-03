"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createCustomer } from "@/lib/data/customers";
import { createClient } from "@/lib/supabase/server";
import { toErrorMessage } from "@/lib/error-message";

export type CreateCustomerState = {
  error: string | null;
};

export async function createCustomerAction(
  _prevState: CreateCustomerState,
  formData: FormData
): Promise<CreateCustomerState> {
  const display_name = String(formData.get("display_name") ?? "").trim();
  const kana = String(formData.get("kana") ?? "").trim();
  const real_name = String(formData.get("real_name") ?? "").trim();
  const birthday = String(formData.get("birthday") ?? "").trim();
  const memo = String(formData.get("memo") ?? "").trim();
  const aliasesRaw = String(formData.get("aliases") ?? "").trim();

  // 第30章 必須項目: 登録名
  if (!display_name) {
    return { error: "登録名を入力してください。" };
  }

  let customer;
  try {
    customer = await createCustomer({
      display_name,
      kana: kana || undefined,
      real_name: real_name || undefined,
      birthday: birthday || undefined,
      memo: memo || undefined,
      aliases: aliasesRaw
        ? aliasesRaw.split(/[、,]/).map((s) => s.trim()).filter(Boolean)
        : [],
    });
  } catch (e) {
    return {
      error:
        e instanceof Error
          ? `保存できませんでした：${e.message}`
          : "保存できませんでした。もう一度お試しください。",
    };
  }

  redirect(`/customers/${customer.id}`);
}

/**
 * 顧客編集（レビュー指摘②）。
 */
export async function updateCustomerAction(
  customerId: string,
  input: {
    display_name: string;
    kana?: string;
    real_name?: string;
    birthday?: string;
    memo?: string;
  }
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update({
      display_name: input.display_name,
      kana: input.kana || null,
      real_name: input.real_name || null,
      birthday: input.birthday || null,
      memo: input.memo || null,
    })
    .eq("id", customerId);

  if (error) {
    throw new Error(toErrorMessage(error, "更新に失敗しました。"));
  }

  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/customers");
}

/**
 * 顧客の無効化・復元（第22章：完全削除ではなく非表示で扱う）。
 * 完全削除は管理者のみ（設定画面等、別途）。
 */
export async function setCustomerHiddenAction(customerId: string, hidden: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update({ hidden })
    .eq("id", customerId);

  if (error) {
    throw new Error(toErrorMessage(error, "変更に失敗しました。"));
  }

  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/customers");
}
export async function toggleFavoriteAction(customerId: string, next: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update({ favorite: next })
    .eq("id", customerId);
  if (error) {
    throw new Error(toErrorMessage(error, "お気に入りの変更に失敗しました。"));
  }
  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/customers");
  revalidatePath("/search");
}

/**
 * 注意・出禁フラグの設定（第10章レビュー指摘）。
 */
export async function setCautionAction(
  customerId: string,
  level: "none" | "caution" | "banned",
  reason: string | null
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("customers")
    .update({
      caution_level: level,
      caution_reason: level === "none" ? null : reason,
      caution_registered_at: level === "none" ? null : new Date().toISOString(),
      caution_registered_by: level === "none" ? null : user?.id ?? null,
    })
    .eq("id", customerId);

  if (error) {
    throw new Error(toErrorMessage(error, "変更に失敗しました。"));
  }

  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/customers");
}

/**
 * 顧客ランクの手動変更（第7章・第32章：管理者のみ）。
 * DB側でもトリガーにより非管理者からの変更は拒否される（002）。
 */
export async function updateCustomerRankAction(customerId: string, rank: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("customers")
    .update({ rank: rank as "first" | "regular" | "vip" | "special" })
    .eq("id", customerId);

  if (error) {
    throw new Error(toErrorMessage(error, "ランクの変更に失敗しました（管理者アカウントか確認してください）。"));
  }

  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/customers");
}
