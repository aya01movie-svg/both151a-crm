import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { listTags } from "@/lib/data/tags";
import { listStaff } from "@/lib/data/staff";
import { listAuditLogs } from "@/lib/data/audit";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardTitle } from "@/components/ui/Card";
import { TagManager } from "@/components/settings/TagManager";
import { StaffManager } from "@/components/settings/StaffManager";
import { CustomerManagePanel } from "@/components/settings/CustomerManagePanel";
import { EventManagePanel } from "@/components/settings/EventManagePanel";
import { ClosedDayPanel } from "@/components/settings/ClosedDayPanel";
import { listStoreEvents, listClosedDays } from "@/lib/data/events";
import { formatDateTime } from "@/lib/date";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SettingsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const isAdmin = profile.role === "admin";
  const tags = await listTags();
  const staff = isAdmin ? await listStaff() : [];
  const auditLogs = isAdmin ? await listAuditLogs(50) : [];

  const events = await listStoreEvents();
  const now = new Date();
  // 前後3ヶ月分の店休日を取得
  const cdFrom = new Date(now); cdFrom.setMonth(cdFrom.getMonth() - 1);
  const cdTo   = new Date(now); cdTo.setMonth(cdTo.getMonth() + 3);
  const closedDays = await listClosedDays(
    cdFrom.toISOString().slice(0, 10),
    cdTo.toISOString().slice(0, 10)
  );

  let customersForManage: { id: string; display_name: string; kana: string | null; visit_count: number }[] = [];
  if (isAdmin) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("customers")
      .select("id, display_name, kana, visit_count")
      .eq("hidden", false)
      .order("display_name", { ascending: true })
      .limit(500);
    customersForManage = (data ?? []) as typeof customersForManage;
  }
  return (
    <AppShell title="設定" staffName={profile.display_name} role={profile.role}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                タグの追加・削除は管理者アカウントでログインしてください。
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
              スタッフ管理・データ出力・変更履歴の閲覧は管理者アカウントでログインすると表示されます。
            </p>
          </Card>
        )}

        {isAdmin && (
          <Card>
            <CardTitle>データ出力</CardTitle>
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
            <CardTitle>変更履歴（直近50件）</CardTitle>
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

        {isAdmin && (
          <Card>
            <CardTitle>🎉 イベント管理</CardTitle>
            <EventManagePanel events={events} />
          </Card>
        )}

        {isAdmin && (
          <Card>
            <CardTitle>🚫 店休日管理</CardTitle>
            <ClosedDayPanel closedDays={closedDays} />
          </Card>
        )}

        {isAdmin && (
          <Card className="lg:col-span-2">
            <CardTitle>⚠️ 顧客整理（管理者専用）</CardTitle>
            <p className="text-xs text-navy/50 mb-3">
              誤登録・重複顧客の削除や統合ができます。削除は元に戻せません。
              営業中の誤操作を防ぐため、この画面（設定ページ）からのみ実行できます。
            </p>
            <CustomerManagePanel customers={customersForManage} />
          </Card>
        )}
      </div>
    </AppShell>
  );
}
