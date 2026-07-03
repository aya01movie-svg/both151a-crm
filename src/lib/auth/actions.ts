"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { validateSupabaseUrl } from "@/lib/supabase/validate-env";

export type LoginState = {
  error: string | null;
};

/**
 * ログイン処理（第6章・第17章）
 * メールアドレス + パスワードでSupabase Authに認証する。
 */
export async function login(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  // RC2修正: Supabase URLの設定ミス（/rest/v1混入など）を分かりやすく通知する
  const envError = validateSupabaseUrl();
  if (envError) {
    return { error: envError };
  }

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "メールアドレスとパスワードを入力してください。" };
  }

  const supabase = await createClient();

  try {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // 第31章 エラー処理: ログイン失敗時のメッセージ
      if (error.status === 400) {
        return { error: "メールアドレスまたはパスワードが正しくありません。" };
      }
      return { error: "ログインできませんでした。もう一度お試しください。" };
    }
  } catch {
    // Supabase未接続（ダミー環境変数のまま等）や通信エラー
    return {
      error:
        "Supabaseに接続できませんでした。環境変数(.env.local)の設定を確認してください。",
    };
  }

  redirect("/dashboard");
}

/**
 * ログアウト処理。
 * 第31章「ログイン切れ: ログイン画面へ戻る」と同じ導線を使う。
 */
export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
