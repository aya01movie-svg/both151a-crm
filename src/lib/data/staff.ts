import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

export async function listStaff(): Promise<Profile[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Profile[];
}
