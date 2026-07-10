/**
 * RC4修正: SupabaseのエラーはJSの Error インスタンスではなく、
 * { message, code, details, hint } という形のプレーンオブジェクト（PostgrestError）。
 * これまで各所で `e instanceof Error ? e.message : "汎用メッセージ"` としていたため、
 * Supabaseの本当のエラー内容が握りつぶされ、常に汎用メッセージだけが表示されていた。
 * この関数はどちらの形のエラーが来ても正しくメッセージを取り出す。
 */
export function toErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string") {
    return (e as { message: string }).message;
  }
  if (typeof e === "string") return e;
  return fallback;
}

/**
 * RC7: Supabase/Postgrestのエラーオブジェクトから message・code・details・hint を
 * すべて連結して返す。「本当のエラー内容を表示してほしい」という要望に応えるため、
 * 通常の toErrorMessage() より詳細な情報を出す（ボトル保存失敗時の警告表示等に使用）。
 */
export function describeSupabaseError(e: unknown): string {
  if (!e || typeof e !== "object") return toErrorMessage(e, "詳細不明のエラー");

  const err = e as { message?: string; code?: string; details?: string; hint?: string };
  const parts: string[] = [];
  if (err.message) parts.push(err.message);
  if (err.code) parts.push(`code=${err.code}`);
  if (err.details) parts.push(`details=${err.details}`);
  if (err.hint) parts.push(`hint=${err.hint}`);
  return parts.length > 0 ? parts.join(" / ") : "詳細不明のエラー";
}
