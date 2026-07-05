import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { listBottles, type BottleStatusFilter } from "@/lib/data/bottles";
import { AppShell } from "@/components/layout/AppShell";
import { CustomerSearchBar } from "@/components/customers/CustomerSearchBar";
import { BottleStatusFilterBar } from "@/components/bottles/BottleStatusFilterBar";
import { BottleRow } from "@/components/bottles/BottleRow";
import { LinkButton } from "@/components/ui/Button";
import { BOTTLE_TYPE_CANDIDATES } from "@/lib/bottle-types";

// RC(v1.1)修正: 本番環境でSupabaseからの取得結果がキャッシュされ、
// 来店登録・集計が画面に反映されないことがあったため、このページは
// 常に最新データを取得するよう明示的に動的レンダリングを強制する。
export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = Promise<{ q?: string; page?: string; status?: string | string[] }>;

export default async function BottlesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const params = await searchParams;
  const page = Number(params.page ?? "0") || 0;
  const statuses = (
    params.status ? (Array.isArray(params.status) ? params.status : [params.status]) : []
  ) as BottleStatusFilter[];

  const { bottles, hasMore } = await listBottles({ search: params.q, page, statuses });

  const baseQuery = new URLSearchParams();
  if (params.q) baseQuery.set("q", params.q);
  statuses.forEach((s) => baseQuery.append("status", s));

  const nextQuery = new URLSearchParams(baseQuery);
  nextQuery.set("page", String(page + 1));
  const prevQuery = new URLSearchParams(baseQuery);
  prevQuery.set("page", String(Math.max(0, page - 1)));

  return (
    <AppShell title="ボトル管理" staffName={profile.display_name} role={profile.role}>
      <div className="mb-3">
        <CustomerSearchBar placeholder="検索：顧客名・ボトル名・種類（同伴者名でも検索可）" />
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {BOTTLE_TYPE_CANDIDATES.map((name) => {
          const q = new URLSearchParams(baseQuery);
          q.set("q", name);
          q.delete("page");
          return (
            <LinkButton
              key={name}
              href={`/bottles?${q.toString()}`}
              variant="outline"
              className="px-2.5 py-1 min-h-0 text-xs"
            >
              {name}
            </LinkButton>
          );
        })}
      </div>

      <BottleStatusFilterBar selected={statuses} />

      <div className="flex flex-col gap-3">
        {bottles.length === 0 && (
          <p className="text-navy/40 text-sm py-8 text-center">
            該当するボトルが見つかりませんでした。
          </p>
        )}
        {bottles.map((b) => (
          <BottleRow key={b.id} bottle={b} />
        ))}
      </div>

      {(page > 0 || hasMore) && (
        <div className="flex justify-center gap-3 mt-6">
          {page > 0 && (
            <LinkButton href={`/bottles?${prevQuery.toString()}`} variant="outline" className="px-6">
              前へ
            </LinkButton>
          )}
          {hasMore && (
            <LinkButton href={`/bottles?${nextQuery.toString()}`} variant="outline" className="px-6">
              次へ
            </LinkButton>
          )}
        </div>
      )}
    </AppShell>
  );
}
