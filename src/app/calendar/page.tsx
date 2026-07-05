import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { getMonthSummary } from "@/lib/data/calendar";
import { AppShell } from "@/components/layout/AppShell";
import { CalendarClient } from "@/components/calendar/CalendarClient";

// RC(v1.1)修正: 本番環境でSupabaseからの取得結果がキャッシュされ、
// 来店登録・集計が画面に反映されないことがあったため、このページは
// 常に最新データを取得するよう明示的に動的レンダリングを強制する。
export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = Promise<{ year?: string; month?: string }>;

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const params = await searchParams;
  const now = new Date();
  const year = Number(params.year) || now.getFullYear();
  const month = Number(params.month) || now.getMonth() + 1;

  const data = await getMonthSummary(year, month);

  return (
    <AppShell title="カレンダー" staffName={profile.display_name} role={profile.role}>
      <CalendarClient data={data} />
    </AppShell>
  );
}
