import { listTags } from "@/lib/data/tags";
import { SearchClient } from "@/components/search/SearchClient";

// RC(v1.1)修正: 本番環境でSupabaseからの取得結果がキャッシュされ、
// 来店登録・集計が画面に反映されないことがあったため、このページは
// 常に最新データを取得するよう明示的に動的レンダリングを強制する。
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SearchPage() {
  const tags = await listTags();

  return (
    <>
      <SearchClient tagNames={tags.map((t) => t.name)} />
    </>
  );
}