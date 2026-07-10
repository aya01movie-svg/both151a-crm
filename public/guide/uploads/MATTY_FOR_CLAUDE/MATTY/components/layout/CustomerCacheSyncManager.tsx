"use client";

import { useEffect } from "react";
import { syncCustomerCache } from "@/lib/offline/customer-cache";

const BACKGROUND_REFRESH_MS = 5 * 60 * 1000; // 5分ごとにバックグラウンド更新（第38章要件）

/**
 * 顧客検索キャッシュ（IndexedDB）をバックグラウンドで最新に保つ。
 * 起動時・オンライン復帰時・5分ごとに、最近閲覧・来店した最大1000件を同期する。
 */
export function CustomerCacheSyncManager() {
  useEffect(() => {
    void syncCustomerCache();
    window.addEventListener("online", syncCustomerCache);
    const interval = setInterval(() => void syncCustomerCache(), BACKGROUND_REFRESH_MS);
    return () => {
      window.removeEventListener("online", syncCustomerCache);
      clearInterval(interval);
    };
  }, []);

  return null;
}
