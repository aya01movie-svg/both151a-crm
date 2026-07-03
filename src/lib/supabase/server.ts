import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

/**
 * サーバーコンポーネント / Server Action / Route Handler から利用するSupabaseクライアント。
 * Cookieベースでセッションを読み書きする。
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component から呼ばれた場合はCookie書き込みができないため無視する。
            // セッションのリフレッシュは middleware.ts 側で行われる。
          }
        },
      },
      global: {
        // Supabase未設定・通信断時に無限待機しないためのタイムアウト（第31章 通信エラー対策）
        fetch: (input, init) =>
          fetch(input, { ...init, signal: AbortSignal.timeout(8000) }),
      },
    }
  );
}
