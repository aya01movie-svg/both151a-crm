"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { StaffRole } from "@/types/database";

/** スタッフの権限（一般/管理者）変更。DBトリガーで管理者以外からの変更は拒否される（002）。 */
export async function updateStaffRoleAction(staffId: string, role: StaffRole) {
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ role }).eq("id", staffId);
  if (error) {
    throw new Error("権限の変更に失敗しました（管理者アカウントか確認してください）。");
  }
  revalidatePath("/settings");
}
