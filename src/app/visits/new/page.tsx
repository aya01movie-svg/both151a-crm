import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { listTags } from "@/lib/data/tags";
import { getLastVisitInfo } from "@/lib/data/visits";
import { getReservationDetail } from "@/lib/data/reservations";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/AppShell";
import { VisitForm } from "@/components/visits/VisitForm";

// RC(v1.1)修正: 本番環境でSupabaseからの取得結果がキャッシュされ、
// 来店登録・集計が画面に反映されないことがあったため、このページは
// 常に最新データを取得するよう明示的に動的レンダリングを強制する。
export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = Promise<{ customer?: string; reservation?: string }>;

export default async function NewVisitPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const { customer: customerIdParam, reservation: reservationId } = await searchParams;
  const tags = await listTags();

  let initialCustomer = null;
  let initialReservation = null;
  let customerId = customerIdParam;

  if (reservationId) {
    const detail = await getReservationDetail(reservationId);
    if (detail) {
      customerId = detail.reservation.customer_id;
      initialReservation = {
        id: detail.reservation.id,
        peopleCount: detail.reservation.people_count,
        companionNames: detail.companionNames,
        bottlePlan: detail.reservation.bottle_plan,
        tagIds: detail.tagIds,
        memo: detail.reservation.memo,
      };
    }
  }

  if (customerId) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("customers")
      .select("id, display_name, caution_level")
      .eq("id", customerId)
      .single();

    if (data) {
      const lastVisitInfo = await getLastVisitInfo(customerId);
      initialCustomer = { ...data, lastVisitInfo };
    }
  }

  return (
    <AppShell title="来店登録" staffName={profile.display_name} role={profile.role}>
      <VisitForm tags={tags} initialCustomer={initialCustomer} initialReservation={initialReservation} />
    </AppShell>
  );
}
