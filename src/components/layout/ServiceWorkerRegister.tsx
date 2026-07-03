"use client";

import { useEffect } from "react";

/**
 * RC3修正: 反復テスト中にService Workerの古いキャッシュが新しいJSを覆い隠し、
 * 「コードは直したのに実機の挙動が変わらない」問題の温床になっていたため、
 * 一旦PWAのオフラインキャッシュ機能を完全に無効化する（キルスイッチ）。
 *
 * 既存にインストール済みのService Workerがあれば積極的に登録解除し、
 * Cache Storageも全消去する。これにより過去のRCで登録されたSWが
 * 実機に残っていても、次回アクセス時に確実にクリアされる。
 *
 * PWAオフライン対応の再有効化はコア機能（保存・検索）の安定後に
 * 改めて設計する（v2）。
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => {
        registration.unregister().catch(() => {
          // 失敗しても致命的ではないため無視する
        });
      });
    }).catch(() => {
      // no-op
    });

    if (typeof caches !== "undefined") {
      caches.keys().then((keys) => {
        keys.forEach((key) => {
          caches.delete(key).catch(() => {
            // no-op
          });
        });
      }).catch(() => {
        // no-op
      });
    }
  }, []);

  return null;
}
