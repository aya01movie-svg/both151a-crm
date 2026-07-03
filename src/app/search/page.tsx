import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { listTags } from "@/lib/data/tags";
import { AppShell } from "@/components/layout/AppShell";
import { SearchClient } from "@/components/search/SearchClient";

export default async function SearchPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const tags = await listTags();

  return (
    <AppShell title="検索・オフライン・設定" staffName={profile.display_name} role={profile.role}>
      <SearchClient tagNames={tags.map((t) => t.name)} />
    </AppShell>
  );
}
