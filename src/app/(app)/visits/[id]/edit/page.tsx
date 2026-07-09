import { notFound } from "next/navigation";
import { getVisitForEdit } from "@/lib/data/visits";
import { VisitEditForm } from "@/components/visits/VisitEditForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function EditVisitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const visit = await getVisitForEdit(id);
  if (!visit) notFound();

  return (
    <>
      <VisitEditForm visit={visit} />
    </>
  );
}
