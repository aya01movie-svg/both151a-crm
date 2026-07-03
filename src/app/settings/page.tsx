import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { listTags } from "@/lib/data/tags";
import { listStaff } from "@/lib/data/staff";
import { listAuditLogs } from "@/lib/data/audit";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardTitle } from "@/components/ui/Card";
import { TagManager } from "@/components/settings/TagManager";
import { StaffManager } from "@/components/settings/StaffManager";
import { ClearLocalDataButton } from "@/components/settings/ClearLocalDataButton";
import { formatDateTime } from "@/lib/date";

export default async function SettingsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const isAdmin = profile.role === "admin";
  const tags = await listTags();
  const staff = isAdmin ? await listStaff() : [];
  const auditLogs = isAdmin ? await listAuditLogs(50) : [];

  return (
    <AppShell title="設定" staffName={profile.display_name} role={profile.role}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardTitle>動作確認用ツール</CardTitle>
          <ClearLocalDataButton />
        </Card>

        <Card>
          <CardTitle>タグ管理</CardTitle>
          {isAdmin ? (
            <TagManager tags={tags} />
          ) : (
            <>
              <div className="flex flex-wrap gap-2 mb-3">
                {tags.map((t) => (
                  <span
                    key={t.id}
                    className="bg-navy/5 text-navy rounded-full px-3 py-1 text-sm font-bold"
                  >
                    {t.name}
                  </span>
                ))}
              </div>
              <p className="text-navy/40 text-sm">
                タグの追加・削除は管理者アカウントでログインしてください（第32章）。
              </p>
            </>
          )}
        </Card>

        {isAdmin ? (
          <Card>
            <CardTitle>スタッフ管理</CardTitle>
            <StaffManager staff={staff} currentUserId={profile.id} />
          </Card>
        ) : (
          <Card className="border-2 border-dashed border-navy/15">
            <CardTitle>管理者専用機能</CardTitle>
            <p className="text-navy/40 text-sm">
              スタッフ管理・CSV出力・監査ログ閲覧は管理者アカウントでログインすると表示されます。
            </p>
          </Card>
        )}

        {isAdmin && (
          <Card>
            <CardTitle>CSV出力</CardTitle>
            <p className="text-navy/50 text-sm mb-3">
              UTF-8形式でダウンロードします（第16章）。
            </p>
            <div className="grid grid-cols-2 gap-2">
              <a href="/api/export/customers" className="btn-base bg-navy text-white text-sm">
                顧客一覧
              </a>
              <a href="/api/export/visits" className="btn-base bg-navy text-white text-sm">
                来店履歴
              </a>
              <a href="/api/export/bottles" className="btn-base bg-navy text-white text-sm">
                ボトル一覧
              </a>
              <a href="/api/export/reservations" className="btn-base bg-navy text-white text-sm">
                予約一覧
              </a>
            </div>
          </Card>
        )}

        {isAdmin && (
          <Card>
            <CardTitle>監査ログ（直近50件）</CardTitle>
            {auditLogs.length === 0 && (
              <p className="text-navy/40 text-sm">まだ記録がありません。</p>
            )}
            <ul className="flex flex-col gap-2 max-h-96 overflow-y-auto text-sm">
              {auditLogs.map((log) => (
                <li key={log.id} className="border-b border-navy/5 pb-2 last:border-0">
                  <p className="font-bold text-navy">
                    {log.tableLabel}を{log.actionLabel}
                    <span className="text-navy/40 font-normal ml-2">{log.actorName}</span>
                  </p>
                  <p className="text-navy/30 text-xs">{formatDateTime(log.created_at)}</p>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
