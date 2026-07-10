"use client";

import { useState } from "react";

/**
 * 開発・検証中にブラウザ側のキャッシュ（localStorage・IndexedDB・Service Worker・
 * Cache Storage）が新しい挙動を隠してしまうのを防ぐための手動クリアボタン。
 * 第38章のオフライン機能とは別に、検証時の混乱を避ける目的で設置する。
 */
export function ClearLocalDataButton() {
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleClear() {
    setPending(true);
    try {
      try {
        localStorage.clear();
      } catch {
        // no-op
      }

      if (typeof indexedDB !== "undefined" && indexedDB.databases) {
        const dbs = await indexedDB.databases();
        await Promise.all(
          dbs
            .filter((db) => db.name)
            .map(
              (db) =>
                new Promise<void>((resolve) => {
                  const req = indexedDB.deleteDatabase(db.name as string);
                  req.onsuccess = () => resolve();
                  req.onerror = () => resolve();
                  req.onblocked = () => resolve();
                })
            )
        );
      }

      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((r) => r.unregister()));
      }

      if (typeof caches !== "undefined") {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }

      setDone(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          void handleClear();
        }}
        className="btn-base bg-danger text-white text-sm px-4 disabled:opacity-50"
      >
        {pending ? "削除中…" : "ローカルデータを全消去（開発用）"}
      </button>
      <p className="text-navy/40 text-xs mt-1">
        localStorage・IndexedDB（オフラインキャッシュ）・Service Workerをすべて削除し、次回読み込みをまっさらな状態にします。実行後はページを再読み込みしてください。
      </p>
      {done && (
        <p className="text-success text-xs font-bold mt-1">
          削除しました。ページを再読み込みしてください。
        </p>
      )}
    </div>
  );
}
