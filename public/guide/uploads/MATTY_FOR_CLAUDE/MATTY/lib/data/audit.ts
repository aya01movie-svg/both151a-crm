import { createClient } from "@/lib/supabase/server";
import type { AuditLog } from "@/types/database";

const ACTION_LABEL: Record<string, string> = {
  INSERT: "追加",
  UPDATE: "編集",
  DELETE: "削除",
};

const TABLE_LABEL: Record<string, string> = {
  customers: "顧客",
  visits: "来店",
  bottles: "ボトル",
  reservations: "予約",
  tags: "タグ",
};

export type AuditLogWithMeta = AuditLog & {
  actorName: string;
  actionLabel: string;
  tableLabel: string;
};

/**
 * 監査ログ一覧（第24章：管理画面のみ閲覧可能。RLSでもadmin限定を強制済み）。
 */
export async function listAuditLogs(limit = 100): Promise<AuditLogWithMeta[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  const actorIds = [...new Set((data ?? []).map((r) => r.actor_id).filter(Boolean))] as string[];
  let nameById = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", actorIds);
    nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));
  }

  return (data ?? []).map((log) => ({
    ...log,
    actorName: log.actor_id ? nameById.get(log.actor_id) ?? "不明" : "システム",
    actionLabel: ACTION_LABEL[log.action] ?? log.action,
    tableLabel: TABLE_LABEL[log.table_name] ?? log.table_name,
  }));
}
