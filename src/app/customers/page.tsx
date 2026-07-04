import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { listCustomers } from "@/lib/data/customers";
import { AppShell } from "@/components/layout/AppShell";
import { CustomerSearchBar } from "@/components/customers/CustomerSearchBar";
import { CustomerCard } from "@/components/customers/CustomerCard";
import { LinkButton } from "@/components/ui/Button";

type SearchParams = Promise<{ q?: string; page?: string; favorite?: string }>;

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const params = await searchParams;
  const page = Number(params.page ?? "0") || 0;
  const favoriteOnly = params.favorite === "1";

  const { customers, hasMore } = await listCustomers({
    search: params.q,
    favoriteOnly,
    page,
  });

  const baseQuery = new URLSearchParams();
  if (params.q) baseQuery.set("q", params.q);
  if (favoriteOnly) baseQuery.set("favorite", "1");

  const prevQuery = new URLSearchParams(baseQuery);
  prevQuery.set("page", String(Math.max(0, page - 1)));
  const nextQuery = new URLSearchParams(baseQuery);
  nextQuery.set("page", String(page + 1));

  const favoriteToggleQuery = new URLSearchParams(baseQuery);
  if (favoriteOnly) favoriteToggleQuery.delete("favorite");
  else favoriteToggleQuery.set("favorite", "1");

  return (
    <AppShell title="顧客一覧" staffName={profile.display_name} role={profile.role}>
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex-1">
          <CustomerSearchBar placeholder="検索：名前・別名・ふりがな・タグ・ボトル・メモ・領収書宛名" />
        </div>
        <div className="flex gap-2">
          <LinkButton
            href={`/customers?${favoriteToggleQuery.toString()}`}
            variant={favoriteOnly ? "gold" : "outline"}
            className="px-4"
          >
            ★お気に入りのみ
          </LinkButton>
          <LinkButton href="/customers/new" variant="navy" className="px-4">
            新規顧客
          </LinkButton>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {customers.length === 0 && (
          <p className="text-navy/40 text-sm py-8 text-center">
            該当する顧客が見つかりませんでした。
          </p>
        )}
        {customers.map((c) => (
          <CustomerCard key={c.id} customer={c} />
        ))}
      </div>

      {(page > 0 || hasMore) && (
        <div className="flex justify-center gap-3 mt-6">
          {page > 0 && (
            <LinkButton href={`/customers?${prevQuery.toString()}`} variant="outline" className="px-6">
              前へ
            </LinkButton>
          )}
          {hasMore && (
            <LinkButton href={`/customers?${nextQuery.toString()}`} variant="outline" className="px-6">
              次へ
            </LinkButton>
          )}
        </div>
      )}
    </AppShell>
  );
}
