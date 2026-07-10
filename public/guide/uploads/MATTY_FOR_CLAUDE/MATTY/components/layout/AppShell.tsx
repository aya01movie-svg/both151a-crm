import { Header } from "./Header";
import { SideNav } from "./SideNav";
import { BottomNav } from "./BottomNav";
import { OfflineBanner } from "./OfflineBanner";
import { SyncManager } from "./SyncManager";
import { CustomerCacheSyncManager } from "./CustomerCacheSyncManager";
import type { StaffRole } from "@/types/database";

type AppShellProps = {
  staffName: string;
  role: StaffRole;
  children: React.ReactNode;
};

/**
 * ログイン後の全画面で共通のレイアウト。
 * v1.2: src/app/(app)/layout.tsx から一度だけ描画されるようになり、
 * ページ遷移のたびに再マウントされなくなった（体感速度改善）。
 * 第33章レスポンシブ仕様:
 *  - タブレット/PC: 左カラムにナビゲーション（SideNav）
 *  - スマホ: 下部固定メニュー（BottomNav）
 * 第38章オフライン対応: OfflineBanner（状態表示）+ SyncManager（自動同期）を常時マウントする。
 */
export function AppShell({ staffName, role, children }: AppShellProps) {
  return (
    <div className="min-h-screen flex flex-col bg-beige overflow-x-hidden">
      <SyncManager />
      <CustomerCacheSyncManager />
      <OfflineBanner />
      <Header staffName={staffName} />
      <div className="flex flex-1 min-h-0">
        <SideNav role={role} />
        <main className="flex-1 min-w-0 max-w-full p-4 md:p-6 pb-24 md:pb-6 overflow-y-auto overflow-x-hidden">
          {children}
        </main>
      </div>
      <BottomNav role={role} />
    </div>
  );
}