import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { AppShell } from "@/components/layout/AppShell";

// v1.2パフォーマンス改善:
// 以前は各ページが個別に <AppShell> を描画し、ページごとに
// getCurrentProfile()（Supabaseへの認証+プロフィール取得の2回の通信）を
// 実行していたため、画面遷移のたびに毎回この待ち時間が発生していた。
// ログイン後の全画面をこの (app) グループ配下にまとめ、レイアウトを
// 共通化することで、
//   - プロフィール取得は「アプリ内に入った時」に一度だけ行われる
//     （Next.jsのApp Routerでは、同じレイアウトを共有する画面間の
//       クライアント側遷移でレイアウト自体は再実行されない）
//   - ヘッダー・ナビゲーションはページ遷移のたびに再マウントされず、
//     中身（children）だけが差し替わるため、体感速度が大きく改善する
// という2点を実現している。
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  return (
    <AppShell staffName={profile.display_name} role={profile.role}>
      {children}
    </AppShell>
  );
}
