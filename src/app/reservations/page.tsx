import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { listReservations } from "@/lib/data/reservations";
import { listTags } from "@/lib/data/tags";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardTitle } from "@/components/ui/Card";
import { ReservationListItem } from "@/components/reservations/ReservationListItem";
import { ReservationForm } from "@/components/reservations/ReservationForm";

// RC(v1.1)修正: 本番環境でSupabaseからの取得結果がキャッシュされ、
// 来店登録・集計が画面に反映されないことがあったため、このページは
// 常に最新データを取得するよう明示的に動的レンダリングを強制する。
export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = Promise<{ customer?: string }>;

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const { customer: customerId } = await searchParams;
  const [{ today, upcoming }, tags] = await Promise.all([
    listReservations(),
    listTags(),
  ]);

  let presetCustomer = null;
  if (customerId) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("customers")
      .select("id, display_name")
      .eq("id", customerId)
      .single();
    presetCustomer = data ?? null;
  }

  return (
    <AppShell title="予約管理" staffName={profile.display_name} role={profile.role}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="flex flex-col gap-4">
          <Card>
            <CardTitle>本日の予約</CardTitle>
            {today.length === 0 && (
              <p className="text-navy/40 text-sm">本日の予約はありません。</p>
            )}
          </Card>
          <div className="flex flex-col gap-3">
            {today.map((r) => (
              <ReservationListItem key={r.id} reservation={r} />
            ))}
          </div>

          <Card>
            <CardTitle>明日以降の予約（今後60日）</CardTitle>
            {upcoming.length === 0 && (
              <p className="text-navy/40 text-sm">今後の予約はありません。</p>
            )}
          </Card>
          <div className="flex flex-col gap-3">
            {upcoming.map((r) => (
              <ReservationListItem key={r.id} reservation={r} showDate />
            ))}
          </div>
        </div>

        <ReservationForm tags={tags} presetCustomer={presetCustomer} />
      </div>
    </AppShell>
  );
}
