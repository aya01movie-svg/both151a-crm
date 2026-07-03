"use client";

import { useEffect, useState, useTransition } from "react";
import { Star } from "lucide-react";
import { toggleFavoriteAction } from "@/lib/actions/customers";

/**
 * お気に入り（第25章）。ON/OFFのみ、星1つで表現する。
 *
 * RC4修正: これまでローカルstateとサーバーの値が食い違い、一覧内の別の顧客の
 * 星が誤って点灯するように見える不具合があった。ローカルに独自の真偽値を
 * 持たず、常にサーバーから渡された favorite の値をそのまま表示することで、
 * 表示のズレが起きないようにした。
 *
 * RC5修正: 一覧の並び順が last_visit_at の同値タイブレークで不安定だった問題は
 * データ取得側（listCustomers）で解消済み。ここでは切り替え直後に一言添えて、
 * 画面が急に変わったように感じないようにする。
 */
export function FavoriteToggle({
  customerId,
  favorite,
  size = 20,
}: {
  customerId: string;
  favorite: boolean;
  size?: number;
}) {
  const [pending, startTransition] = useTransition();
  const [justChanged, setJustChanged] = useState(false);

  useEffect(() => {
    if (!justChanged) return;
    const timer = setTimeout(() => setJustChanged(false), 1500);
    return () => clearTimeout(timer);
  }, [justChanged]);

  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await toggleFavoriteAction(customerId, !favorite);
            setJustChanged(true);
          })
        }
        aria-pressed={favorite}
        aria-label={favorite ? "お気に入りを解除" : "お気に入りに追加"}
        className="inline-flex items-center justify-center disabled:opacity-50"
      >
        <Star
          size={size}
          className={favorite ? "text-gold" : "text-navy/25"}
          fill={favorite ? "currentColor" : "none"}
          strokeWidth={1.75}
        />
      </button>
      {justChanged && (
        <span className="text-[10px] font-bold text-navy/40">変更しました</span>
      )}
    </span>
  );
}
