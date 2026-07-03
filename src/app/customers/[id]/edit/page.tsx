import { redirect, notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { getCustomerDetail } from "@/lib/data/customers";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardTitle } from "@/components/ui/Card";
import { CustomerEditForm } from "@/components/customers/CustomerEditForm";

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const { id } = await params;
  const detail = await getCustomerDetail(id);
  if (!detail) notFound();

  return (
    <AppShell title="顧客編集" staffName={profile.display_name} role={profile.role}>
      <Card className="max-w-2xl">
        <CardTitle>顧客編集</CardTitle>
        <CustomerEditForm customer={detail.customer} />
      </Card>
    </AppShell>
  );
}
