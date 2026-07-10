"use client";

import { usePathname } from "next/navigation";

// v1.2: 以前は各ページが <AppShell title="..."> のように個別にタイトルを
// 渡していたが、共通レイアウト化に伴いページ側でAppShellを描画しなくなった
// ため、現在のURLから見出しを判定するクライアントコンポーネントに変更した。
// （並び順は longer/more specific なパスから先に判定する）
const TITLES: { pattern: RegExp; title: string }[] = [
  { pattern: /^\/customers\/new/, title: "新規顧客登録" },
  { pattern: /^\/customers\/[^/]+\/edit/, title: "顧客編集" },
  { pattern: /^\/customers\/[^/]+$/, title: "顧客詳細" },
  { pattern: /^\/customers/, title: "顧客一覧" },
  { pattern: /^\/visits\/new/, title: "来店登録" },
  { pattern: /^\/visits\/[^/]+\/edit/, title: "来店を修正" },
  { pattern: /^\/dashboard/, title: "ホーム" },
  { pattern: /^\/bottles/, title: "ボトル管理" },
  { pattern: /^\/calendar/, title: "お知らせ" },
  { pattern: /^\/reservations/, title: "予約管理" },
  { pattern: /^\/search/, title: "検索" },
  { pattern: /^\/settings/, title: "設定" },
];

export function PageTitle() {
  const pathname = usePathname();
  const match = TITLES.find((t) => t.pattern.test(pathname));
  if (!match) return null;
  return (
    <span className="text-navy-dark/60 text-sm truncate hidden sm:inline pl-1">
      {match.title}
    </span>
  );
}
