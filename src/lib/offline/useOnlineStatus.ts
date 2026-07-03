"use client";

import { useEffect, useState } from "react";

/**
 * 通信状態を監視するフック（第38章「オフライン保存中」表示の判定に使用）。
 *
 * RC3修正: 初期値で navigator.onLine を直接読むと、サーバー描画（常にtrue扱い）と
 * クライアント初回描画の結果が一致しない場合に Hydration Error を起こしうる
 * （特に一部のAndroidタブレットではnavigator.onLineが不安定に false を返すことがある）。
 * このフックは AppShell 経由で全ページに常時マウントされるため、ここでの
 * Hydration Errorはアプリ全体のイベントハンドラ喪失に波及しうる。
 * そのため初期値は常にサーバーと同じ true とし、実際の状態はマウント後に補正する。
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    // マウント後（ハイドレーション完了後）に実際の状態へ補正する
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 外部API(navigator.onLine)への同期のため意図的
    setOnline(typeof navigator === "undefined" ? true : navigator.onLine);

    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return online;
}
