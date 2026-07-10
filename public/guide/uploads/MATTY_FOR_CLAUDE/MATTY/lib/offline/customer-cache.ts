import {
  dbReplaceCustomerCache,
  dbGetAllCachedCustomers,
  dbGetCustomerCacheCount,
  dbSetMeta,
  dbGetMeta,
  type CachedCustomer,
} from "./db";
import { fetchCustomerCacheAction } from "@/lib/actions/customer-cache";

const LAST_SYNCED_KEY = "customer-cache-last-synced-at";

export type CacheStatus = {
  syncing: boolean;
  count: number;
  lastSyncedAt: string | null;
};

type Listener = (status: CacheStatus) => void;
const listeners = new Set<Listener>();
let currentStatus: CacheStatus = { syncing: false, count: 0, lastSyncedAt: null };
let syncInFlight = false;

function emit() {
  listeners.forEach((l) => l(currentStatus));
}

export function subscribeCacheStatus(listener: Listener): () => void {
  listeners.add(listener);
  listener(currentStatus);
  // 初回購読時に保存済みの件数・同期時刻を読み込む
  void (async () => {
    try {
      const [count, lastSyncedAt] = await Promise.all([
        dbGetCustomerCacheCount(),
        dbGetMeta(LAST_SYNCED_KEY),
      ]);
      currentStatus = { ...currentStatus, count, lastSyncedAt };
      emit();
    } catch {
      // IndexedDB未対応環境では無視する
    }
  })();
  return () => listeners.delete(listener);
}

function buildSearchBlob(input: {
  display_name: string;
  kana: string | null;
  real_name: string | null;
  memo: string | null;
  aliases: string[];
  tags: string[];
  receiptNames: string[];
}): string {
  return [
    input.display_name,
    input.kana ?? "",
    input.real_name ?? "",
    input.memo ?? "",
    ...input.aliases,
    ...input.tags,
    ...input.receiptNames,
  ]
    .join(" ")
    .toLowerCase();
}

/**
 * サーバーから最新1000件（第38章の要件）を取得し、IndexedDBを丸ごと入れ替える。
 * オンライン時: 起動時・オンライン復帰時・5分ごとのバックグラウンド更新から呼ばれる。
 */
export async function syncCustomerCache(): Promise<void> {
  if (syncInFlight) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;

  syncInFlight = true;
  currentStatus = { ...currentStatus, syncing: true };
  emit();

  try {
    const records = await fetchCustomerCacheAction();
    const cached: CachedCustomer[] = records.map((r) => ({
      ...r,
      searchBlob: buildSearchBlob(r),
    }));
    await dbReplaceCustomerCache(cached);
    const now = new Date().toISOString();
    await dbSetMeta(LAST_SYNCED_KEY, now);
    currentStatus = { syncing: false, count: cached.length, lastSyncedAt: now };
  } catch {
    // オフライン・通信エラー時は既存キャッシュをそのまま維持する
    currentStatus = { ...currentStatus, syncing: false };
  } finally {
    syncInFlight = false;
    emit();
  }
}

export type SearchResult = {
  id: string;
  display_name: string;
  kana: string | null;
  real_name: string | null;
  favorite: boolean;
  rank: string;
  last_visit_at: string | null;
  visit_count: number;
  tags: string[];
};

/** オフライン検索（第9章・第19章：名前・ふりがな・本名・タグ・領収書宛名・メモが対象）。 */
export async function searchCachedCustomers(query: string): Promise<SearchResult[]> {
  const term = query.trim().toLowerCase();
  if (!term) return [];

  const all = await dbGetAllCachedCustomers();
  return all
    .filter((c) => c.searchBlob.includes(term))
    .sort((a, b) => (b.last_visit_at ?? "").localeCompare(a.last_visit_at ?? ""))
    .slice(0, 50)
    .map((c) => ({
      id: c.id,
      display_name: c.display_name,
      kana: c.kana,
      real_name: c.real_name,
      favorite: c.favorite,
      rank: c.rank,
      last_visit_at: c.last_visit_at,
      visit_count: c.visit_count,
      tags: c.tags,
    }));
}
