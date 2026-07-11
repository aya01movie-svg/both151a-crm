"use client";

import { useEffect, useRef } from "react";

type HelpGuideModalProps = {
  /** モーダルの開閉状態 */
  open: boolean;
  /** 閉じる操作（×・閉じるボタン・背景クリック・Escキー共通） */
  onClose: () => void;
  /** iframeで表示するガイドページのURL（例: /guide/index.html） */
  url: string;
  /** モーダルタイトル（既定: 「MATTY 使い方ガイド」） */
  title?: string;
};

/**
 * MATTY本体の画面内に、使い方ガイド（public/guide/ 以下の静的HTML）を
 * iframeで表示する共通モーダル。
 *
 * - window.open や新しいタブは使わない（PWAスコープの問題を回避するため）
 * - 閉じている間はDOMごとアンマウントする（openがfalseの間はiframeを生成しない）
 *   ことで、Android 7.0のような非力な端末でも背景に重い要素を残さない
 * - 背景スクロール抑制・Escキー・背景クリックでの閉じるに対応
 */
export function HelpGuideModal({ open, onClose, url, title = "MATTY 使い方ガイド" }: HelpGuideModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // 背景スクロール抑制 ＋ Escキーで閉じる
  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      onClick={(e) => {
        // モーダル外（オーバーレイそのもの）をクリックした時だけ閉じる
        if (e.target === overlayRef.current) onClose();
      }}
      className="fixed inset-0 z-[999] bg-black/50 flex items-center justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="bg-white w-full h-full sm:h-[85vh] sm:max-w-3xl sm:rounded-app flex flex-col shadow-xl overflow-hidden">
        {/* タイトルバー */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-navy/10 bg-gold shrink-0">
          <p className="font-black text-navy-dark text-base truncate">{title}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="min-h-10 min-w-10 shrink-0 flex items-center justify-center rounded-app text-navy-dark text-2xl leading-none font-bold hover:bg-black/10 active:bg-black/20"
          >
            ×
          </button>
        </div>

        {/* ガイド本体（iframe） */}
        <div className="flex-1 min-h-0 bg-white">
          <iframe
            src={url}
            title={title}
            className="w-full h-full border-0"
          />
        </div>

        {/* 分かりやすい「閉じる」ボタン */}
        <div className="px-4 py-3 border-t border-navy/10 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-12 rounded-app bg-navy text-white font-bold text-sm hover:opacity-90 active:opacity-80"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
