import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { getMonthSummary } from "@/lib/data/calendar";
import { AppShell } from "@/components/layout/AppShell";
import { CalendarClient } from "@/components/calendar/CalendarClient";

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
      <p className="text-navy/50 text-sm mb-4">何日に誰が来たかを一目で確認</p>
      <CalendarClient data={data} />
    </AppShell>
  );
}
