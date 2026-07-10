"use client";

import { useEffect } from "react";
import { flushQueue } from "@/lib/offline/queue";
import { saveVisitAction } from "@/lib/actions/visits";
import { initialSaveVisitState } from "@/lib/actions/visits-state";
import { saveReservationAction } from "@/lib/actions/reservations";
import { addNoteAction } from "@/lib/actions/notes";

/**
 * 通信復旧を検知して、端末に一時保存された来店登録・予約登録・メモ入力を
 * 自動的にSupabaseへ再送信する（第38章）。画面には何も描画しない。
 */
export function SyncManager() {
  useEffect(() => {
    let cancelled = false;

    async function trySync() {
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      if (cancelled) return;
      await flushQueue({
        visit: (fd) => saveVisitAction(initialSaveVisitState, fd),
        reservation: (fd) => saveReservationAction({ error: null, success: false }, fd),
        note: (fd) => addNoteAction({ error: null }, fd),
      });
    }

    void trySync();
    window.addEventListener("online", trySync);
    const interval = setInterval(trySync, 30000);

    return () => {
      cancelled = true;
      window.removeEventListener("online", trySync);
      clearInterval(interval);
    };
  }, []);

  return null;
}
