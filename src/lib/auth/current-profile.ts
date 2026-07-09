import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

/**
 * ログイン中スタッフの profiles 行を取得する。
 * ヘッダーの「ログイン中：スタッフ名」表示や、管理者専用UIの出し分けに使う。
 * middleware.ts で未ログインは既に /login へ弾かれているため、
 * ここで user が null の場合は想定外エラーとして扱う。
 *
 * v1.2パフォーマンス改善: React の cache() でラップし、同一リクエスト内で
 * （例: 共通レイアウトと個別ページの両方から呼ばれた場合など）複数回呼び出されても
 * Supabaseへの問い合わせは1回だけになるようにする。
 */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return profile;
});