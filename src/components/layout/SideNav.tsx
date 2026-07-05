"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./nav-items";
import type { StaffRole } from "@/types/database";

/**
 * タブレット横向き・PC用の左カラムナビゲーション。
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
                  ? "bg-gold text-navy-dark"
                  : "text-navy/70 hover:bg-gold/10"
              }`}
            >
              <Icon size={20} strokeWidth={2.25} />
              {item.label}
            </Link>
          );
        }
      )}

      <div className="mt-auto flex items-center gap-2 px-4 py-3 text-navy/40">
        <Image
          src="/icons/matty-icon-96.png"
          alt=""
          width={24}
          height={24}
          className="rounded-full"
        />
        <div className="leading-tight">
          <p className="text-xs font-bold">MATTY</p>
          <p className="text-[10px]">Ver. 1.1.0</p>
        </div>
      </div>
    </nav>
  );
}
