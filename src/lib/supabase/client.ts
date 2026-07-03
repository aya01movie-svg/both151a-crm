import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

/**
 * クライアントコンポーネント（ブラウザ）から利用するSupabaseクライアント。
 * "use client" コンポーネント内で呼び出す。
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
