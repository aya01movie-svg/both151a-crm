"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { useOnlineStatus } from "@/lib/offline/useOnlineStatus";
import { searchCachedCustomers } from "@/lib/offline/customer-cache";
import { searchCustomersOnlineAction } from "@/lib/actions/search";

export function DashboardSearch() {
  const online = useOnlineStatus();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const term = query.trim();
    if (!term) {
      setResults([]);
      return;
    }

    timerRef.current = setTimeout(async () => {
      setLoading(true);
      if (!online) {
        const cached = await searchCachedCustomers(term);
        setResults(cached);
      } else {
        try {
          const onlineResults = await searchCustomersOnlineAction(term);
          setResults(onlineResults);
        } catch {
          const cached = await searchCachedCustomers(term);
          setResults(cached);
        }
      }
      setLoading(false);
    }, 250);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, online]);

  return (
    <div className="relative mb-5 z-20">
      <div className="relative">
        <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-navy/30" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="名前・タグ・メモ・ボトル等で全検索..."
          className="w-full min-h-14 rounded-app border-2 border-navy/10 bg-white pl-12 pr-12 text-base text-navy placeholder:text-navy/30 focus:outline-none focus:border-gold transition-colors shadow-sm"
        />
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(""); setResults([]); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-navy/40 hover:text-navy"
          >
            <X size={24} />
          </button>
        )}
      </div>

      {query.trim() && (
        <div className="absolute top-full left-0 w-full mt-2 bg-white rounded-app shadow-xl border border-navy/10 max-h-[60vh] overflow-y-auto">
          {loading && results.length === 0 && <p className="p-4 text-center text-sm text-navy/50 font-bold">検索中...</p>}
          {!loading && results.length === 0 && <p className="p-4 text-center text-sm text-navy/50 font-bold">見つかりませんでした</p>}
          {results.map(c => (
            <Link key={c.id} href={`/customers/${c.id}`} className="block p-4 border-b border-navy/5 hover:bg-navy/5">
              <div className="flex justify-between items-center mb-1">
                <span className="font-black text-xl text-navy">{c.display_name}</span>
                <span className="text-sm font-bold text-navy/50">来店 {c.visit_count}回</span>
              </div>
              <div className="text-xs text-navy/40 mb-1">{c.memo?.substring(0, 30)}</div>
              {c.tags?.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {c.tags.map((t: string) => <span key={t} className="text-xs font-bold text-navy/60 bg-navy/5 px-2 py-0.5 rounded-full">{t}</span>)}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}