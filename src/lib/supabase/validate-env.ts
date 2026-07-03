/**
 * Supabase URL設定の簡易バリデーション。
 * よくある設定ミス「URLの末尾に /rest/v1 を含めてしまう」を検知し、
 * 分かりやすいエラーメッセージを返す（RC2レビュー指摘対応）。
 */
export function validateSupabaseUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

  if (!url) {
    return "環境変数 NEXT_PUBLIC_SUPABASE_URL が設定されていません。.env.local を確認してください。";
  }
  if (url.includes("/rest/v1")) {
    return "Supabase URLの末尾に /rest/v1 が含まれています。.env.local の NEXT_PUBLIC_SUPABASE_URL は「https://xxxxx.supabase.co」の形式（/rest/v1 は不要）にしてください。";
  }
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url) && !url.includes("dummy")) {
    // ダミー値や独自ドメイン運用など正当なケースもあるため、警告のみで処理は止めない
    return null;
  }
  return null;
}
