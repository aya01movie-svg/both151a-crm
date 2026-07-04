import type { LucideIcon } from "lucide-react";
import {
  Home,
  PenLine,
  Search,
  Users,
  CalendarClock,
  CalendarDays,
  Wine,
  Settings,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  /** 下部固定メニュー（スマホ）用の短縮ラベル。未指定時は label を使う。 */
  shortLabel?: string;
  icon: LucideIcon;
  /** 管理者のみ表示する項目 */
  adminOnly?: boolean;
};

// ホーム画面から遷移する項目
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "ホーム", icon: Home },
  { href: "/visits/new", label: "来店登録", shortLabel: "来店", icon: PenLine },
  { href: "/search", label: "顧客検索", shortLabel: "検索", icon: Search },
  { href: "/customers", label: "顧客一覧", shortLabel: "一覧", icon: Users },
  { href: "/reservations", label: "予約", icon: CalendarClock },
  { href: "/calendar", label: "カレンダー", shortLabel: "予定", icon: CalendarDays },
  { href: "/bottles", label: "ボトル", icon: Wine },
  { href: "/settings", label: "設定", icon: Settings },
];
