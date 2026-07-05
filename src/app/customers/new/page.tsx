import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { AppShell } from "@/components/layout/AppShell";
import { NewCustomerForm } from "@/components/customers/NewCustomerForm";

// RC(v1.1)修正: 本番環境でSupabaseからの取得結果がキャッシュされ、
// 来店登録・集計が画面に反映されないことがあったため、このページは
// 常に最新データを取得するよう明示的に動的レンダリングを強制する。
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NewCustomerPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  return (
    <AppShell title="新規顧客登録" staffName={profile.display_name} role={profile.role}>
      <NewCustomerForm />
    </AppShell>
  );
}
