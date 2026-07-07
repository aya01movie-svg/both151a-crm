import type { LucideIcon } from "lucide-react";
import {
  Home,
  PenLine,
  Search,
  Users,
  CalendarClock,
  Wine,
  Settings,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  shortLabel?: string;
  icon: LucideIcon | null;
  /** icon が null のとき使う画像パス */
  imageSrc?: string;
  adminOnly?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard",    label: "ホーム",   icon: Home },
  { href: "/visits/new",   label: "来店登録", shortLabel: "来店", icon: PenLine },
  { href: "/search",       label: "顧客検索", shortLabel: "検索", icon: Search },
  { href: "/customers",    label: "顧客一覧", shortLabel: "一覧", icon: Users },
  { href: "/reservations", label: "予約",     icon: CalendarClock },
  {
    href: "/calendar",
    label: "お知らせ",
    icon: null,
    imageSrc: "/icons/matty-transparent-96.png",
  },
  { href: "/bottles",  label: "ボトル", icon: Wine },
  { href: "/settings", label: "設定",   icon: Settings },
];
