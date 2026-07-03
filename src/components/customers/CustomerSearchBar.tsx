"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

type Props = {
  placeholder: string;
  paramName?: string;
};

/**
 * 入力に応じてURLの検索クエリを更新する（第9章「リアルタイム検索」）。
 * 300msデバウンスして遷移することで、サーバー再検索の頻度を抑えつつ
 * 体感速度を維持する（第35章 検索300ms以内）。
 */
export function CustomerSearchBar({ placeholder, paramName = "q" }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get(paramName) ?? "");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (value.trim()) {
        params.set(paramName, value.trim());
      } else {
        params.delete(paramName);
      }
      params.delete("page");
      router.push(`${pathname}?${params.toString()}`);
    }, 300);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="relative">
      <Search
        size={20}
        className="absolute left-4 top-1/2 -translate-y-1/2 text-navy/30"
      />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="w-full min-h-14 rounded-app border-2 border-navy/10 bg-white pl-12 pr-4 text-base text-navy placeholder:text-navy/30 focus:outline-none focus:border-gold transition-colors"
      />
    </div>
  );
}
