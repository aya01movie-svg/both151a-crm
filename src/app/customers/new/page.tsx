import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { AppShell } from "@/components/layout/AppShell";
import { NewCustomerForm } from "@/components/customers/NewCustomerForm";

export default async function NewCustomerPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  return (
    <AppShell title="新規顧客登録" staffName={profile.display_name} role={profile.role}>
      <NewCustomerForm />
    </AppShell>
  );
}
