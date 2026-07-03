import { redirect } from "next/navigation";

// ルートアクセス時は常にホーム(ダッシュボード)へ。
// 未ログインの場合は middleware.ts が /login へリダイレクトする。
export default function RootPage() {
  redirect("/dashboard");
}
