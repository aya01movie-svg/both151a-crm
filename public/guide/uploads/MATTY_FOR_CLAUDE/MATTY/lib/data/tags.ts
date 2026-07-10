import { createClient } from "@/lib/supabase/server";
import type { Tag } from "@/types/database";

/** タグ一覧取得。タグの新規作成・削除（タグ管理）はPhase C・設定画面で実装する。 */
export async function listTags(): Promise<Tag[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tags")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Tag[];
}
