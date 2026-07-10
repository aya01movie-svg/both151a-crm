"use client";

import { useEffect, useState } from "react";
import { useOnlineStatus } from "@/lib/offline/useOnlineStatus";
import { subscribePendingCount } from "@/lib/offline/queue";

/** 第38章:「オフライン中は画面上部へ『オフライン保存中』と表示する」 */
export function OfflineBanner() {
  const online = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => subscribePendingCount(setPendingCount), []);

  if (online && pendingCount === 0) return null;

  return (
    <div
      className={`text-center text-xs font-bold py-1.5 px-2 ${
        online ? "bg-success text-white" : "bg-warn text-white"
      }`}
      role="status"
    >
      {online
        ? `保存中のデータ ${pendingCount}件を同期しています…`
        : pendingCount > 0
        ? `オフライン保存中（未送信 ${pendingCount}件・復旧後に自動同期）`
        : "オフライン保存中（復旧後に自動同期）"}
    </div>
  );
}
