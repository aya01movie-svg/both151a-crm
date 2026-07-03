"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search, Wifi, WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/lib/offline/useOnlineStatus";
import { subscribeCacheStatus, searchCachedCustomers, type CacheStatus } from "@/lib/offline/customer-cache";
import { searchCustomersOnlineAction } from "@/lib/actions/search";
import { BOTTLE_TYPE_CANDIDATES } from "@/lib/bottle-types";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { RankBadge } from "@/components/customers/RankBadge";
import { FavoriteStars } from "@/components/customers/FavoriteStars";
import { daysSince } from "@/lib/date";
import type { CustomerRank } from "@/types/database";

type Result = {
  id: string;
  display_name: string;
  kana: string | null;
  real_name: string | null;
  favorite: boolean;
  rank: string;
  last_visit_at: string | null;
  visit_count: number;
  tags: string[];
  cameWithNames?: string[];
};

function formatSyncTime(iso: string | null): string {
  if (!iso) return "未同期";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}時点`;
}

export function SearchClient({ tagNames = [] }: { tagNames?: string[] }) {
  const online = useOnlineStatus();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [searchedVia, setSearchedVia] = useState<"online" | "offline" | null>(null);
  const [loading, setLoading] = useState(false);
  const [cacheStatus, setCacheStatus] = useState<CacheStatus>({
    syncing: false,
    count: 0,
    lastSyncedAt: null,
  });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => subscribeCacheStatus(setCacheStatus), []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const term = query.trim();
    if (!term) {
      return;
    }

    timerRef.current = setTimeout(() => {
      const requestId = ++requestIdRef.current;
      setLoading(true);

      const run = async () => {
        // 第38章: オフライン時は必ずIndexedDBキャッシュから検索する。
        // オンライン時も、まず体感速度優先でキャッシュ結果を即時表示しつつサーバー結果に差し替える。
        if (!online) {
          const cached = await searchCachedCustomers(term);
          if (requestId !== requestIdRef.current) return;
          setResults(cached);
          setSearchedVia("offline");
          setLoading(false);
          return;
        }

        try {
          const onlineResults = await searchCustomersOnlineAction(term);
          if (requestId !== requestIdRef.current) return;
          setResults(onlineResults);
          setSearchedVia("online");
        } catch {
          // オンライン検索が失敗した場合はキャッシュへフォールバック
          const cached = await searchCachedCustomers(term);
          if (requestId !== requestIdRef.current) return;
          setResults(cached);
          setSearchedVia("offline");
        } finally {
          if (requestId === requestIdRef.current) setLoading(false);
        }
      };

      void run();
    }, 250);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, online]);

  return (
    <div>
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-navy/30" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="検索：社長 / 吉四六 / 領収書 / VIP / メモの内容"
            autoFocus
            className="w-full min-h-14 rounded-app border-2 border-navy/10 bg-white pl-12 pr-4 text-base text-navy placeholder:text-navy/30 focus:outline-none focus:border-gold transition-colors"
          />
        </div>

        <span
          className={`inline-flex items-center gap-1.5 text-xs font-bold rounded-full px-3 py-1.5 shrink-0 ${
            online ? "bg-success/15 text-success" : "bg-warn/15 text-warn"
          }`}
        >
          {online ? <Wifi size={14} /> : <WifiOff size={14} />}
          {searchedVia === "offline"
            ? "オフライン検索（保存データ）"
            : online
            ? "オンライン検索"
            : "オフライン検索（保存データ）"}
        </span>
      </div>

      <p className="text-navy/40 text-xs mb-4">
        検索対象：登録名・別名・ふりがな・本名／タグ／領収書宛名／メモ／同伴者・金額・チップ・日付（オンライン時）　
        {cacheStatus.count > 0 && (
          <>
            ・オフライン用に{cacheStatus.count.toLocaleString()}件を保存済み（
            {formatSyncTime(cacheStatus.lastSyncedAt)}
            {cacheStatus.syncing ? "・更新中…" : ""}）
          </>
        )}
      </p>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {["株式会社", "(株)", ...tagNames, ...BOTTLE_TYPE_CANDIDATES].map((word) => (
          <button
            key={word}
            type="button"
            onClick={() => setQuery(word)}
            className="px-2.5 py-1 rounded-full text-xs font-bold border border-navy/10 text-navy/50 hover:bg-navy/5 active:bg-navy/10"
          >
            {word}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {!query.trim() && (
          <p className="text-navy/30 text-sm py-8 text-center">
            検索キーワードを入力してください。
          </p>
        )}
        {query.trim() && !loading && results.length === 0 && (
          <p className="text-navy/40 text-sm py-8 text-center">
            「{query}」に一致する顧客が見つかりませんでした。
            {!online && "（オフライン検索は保存済みデータのみが対象です）"}
          </p>
        )}
        {query.trim() &&
          results.map((c) => <SearchResultRow key={c.id} customer={c} />)}
      </div>
    </div>
  );
}

function SearchResultRow({ customer }: { customer: Result }) {
  return (
    <Card className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <Link href={`/customers/${customer.id}`} className="text-lg font-black text-navy hover:underline">
            {customer.display_name}
          </Link>
          <FavoriteStars favorite={customer.favorite} />
          <RankBadge rank={customer.rank as CustomerRank} />
          {customer.tags.map((t) => (
            <span key={t} className="text-[11px] font-bold text-navy/50 bg-navy/5 rounded-full px-2 py-0.5">
              {t}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-navy/60">
          <span>来店{customer.visit_count}回</span>
          <span>
            最終
            {customer.last_visit_at ? `${daysSince(customer.last_visit_at)}日前` : "来店なし"}
          </span>
          {customer.kana && <span>{customer.kana}</span>}
        </div>
        {customer.cameWithNames && customer.cameWithNames.length > 0 && (
          <p className="text-xs font-bold text-info mt-1">
            同伴履歴：{customer.cameWithNames.join("、")}様と
          </p>
        )}
      </div>
      <div className="flex gap-2 shrink-0">
        <LinkButton href={`/visits/new?customer=${customer.id}`} variant="gold" className="px-4">
          来店
        </LinkButton>
        <LinkButton href={`/customers/${customer.id}`} variant="navy" className="px-4">
          詳細
        </LinkButton>
      </div>
    </Card>
  );
}
