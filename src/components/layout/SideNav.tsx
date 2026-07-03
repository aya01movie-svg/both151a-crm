"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./nav-items";
import type { StaffRole } from "@/types/database";

/**
 * タブレット横向き・PC用の左カラムナビゲーション（第33章）。
 * md以上の画面幅で表示し、スマホでは BottomNav に切り替える。
 */
export function SideNav({ role }: { role: StaffRole }) {
  const pathname = usePathname();

  return (
    <nav className="hidden md:flex md:flex-col w-56 shrink-0 bg-white border-r border-navy/10 py-4 px-3 gap-1">
      {NAV_ITEMS.filter((item) => !item.adminOnly || role === "admin").map(
        (item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-app px-4 py-3 text-sm font-bold transition-colors ${
                active
                  ? "bg-navy text-white"
                  : "text-navy/70 hover:bg-navy/5"
              }`}
            >
              <Icon size={20} strokeWidth={2.25} />
              {item.label}
            </Link>
          );
        }
      )}
    </nav>
  );
}
