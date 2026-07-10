"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { toErrorMessage } from "@/lib/error-message";

// ─────────────────────────────────────────────
// イベント
// ─────────────────────────────────────────────

export async function saveStoreEventAction(input: {
  id?: string;
  title: string;
  emoji: string;
  event_type: string;
  schedule_type: string;
  start_date?: string | null;
  end_date?: string | null;
  annual_month?: number | null;
  annual_day?: number | null;
  weekly_day?: number | null;
  url?: string | null;
  memo?: string | null;
}) {
  const supabase = await createClient();

  const payload = {
    title: input.title.trim(),
    emoji: input.emoji || "📅",
    event_type: input.event_type || "other",
    schedule_type: input.schedule_type,
    start_date: input.start_date || null,
    end_date: input.end_date || null,
    annual_month: input.annual_month || null,
    annual_day: input.annual_day || null,
    weekly_day: input.weekly_day ?? null,
    url: input.url?.trim() || null,
    memo: input.memo?.trim() || null,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("store_events").update(payload).eq("id", input.id);
    if (error) throw new Error(toErrorMessage(error, "更新に失敗しました。"));
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("store_events").insert(payload);
    if (error) throw new Error(toErrorMessage(error, "保存に失敗しました。"));
  }

  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  revalidatePath("/settings");
}

export async function deleteStoreEventAction(id: string) {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("store_events").delete().eq("id", id);
  if (error) throw new Error(toErrorMessage(error, "削除に失敗しました。"));
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  revalidatePath("/settings");
}

// ─────────────────────────────────────────────
// 店休日
// ─────────────────────────────────────────────

export async function saveClosedDayAction(date: string, note: string) {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("closed_days")
    .upsert({ date, note: note.trim() || null }, { onConflict: "date" });
  if (error) throw new Error(toErrorMessage(error, "保存に失敗しました。"));
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  revalidatePath("/settings");
}

export async function deleteClosedDayAction(id: string) {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("closed_days").delete().eq("id", id);
  if (error) throw new Error(toErrorMessage(error, "削除に失敗しました。"));
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  revalidatePath("/settings");
}
