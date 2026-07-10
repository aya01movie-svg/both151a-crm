import { notFound } from "next/navigation";
import { getCustomerDetail } from "@/lib/data/customers";
import { Card, CardTitle } from "@/components/ui/Card";
import { CustomerEditForm } from "@/components/customers/CustomerEditForm";

// RC(v1.1)修正: 本番環境でSupabaseからの取得結果がキャッシュされ、
// 来店登録・集計が画面に反映されないことがあったため、このページは
// 常に最新データを取得するよう明示的に動的レンダリングを強制する。
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getCustomerDetail(id);
  if (!detail) notFound();

  return (
    <>
      <Card className="max-w-2xl">
        <CardTitle>顧客編集</CardTitle>
        <CustomerEditForm customer={detail.customer} />
      </Card>
    </>
  );
}