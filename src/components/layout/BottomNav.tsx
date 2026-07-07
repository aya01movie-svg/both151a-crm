"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./nav-items";
import type { StaffRole } from "@/types/database";

export function BottomNav({ role }: { role: StaffRole }) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => !item.adminOnly || role === "admin");

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 bg-white border-t border-navy/10 flex pb-[env(safe-area-inset-bottom)]">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon   = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch={true}
            className={`flex-1 min-w-0 min-h-14 flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold px-0.5 ${
              active ? "text-navy" : "text-navy/40"
            }`}
          >
            {/* MATTYアイコン（画像）またはLucideアイコン */}
            {item.imageSrc ? (
              <Image
                src={item.imageSrc}
                alt={item.label}
                width={22}
                height={22}
                className={active ? "opacity-100" : "opacity-40"}
              />
            ) : Icon ? (
              <Icon size={20} strokeWidth={active ? 2.5 : 2} />
            ) : null}
            <span className="truncate max-w-full">{item.shortLabel ?? item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
