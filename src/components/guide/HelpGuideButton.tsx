"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { HelpGuideModal } from "./HelpGuideModal";
import { getGuideUrlForPath } from "@/lib/guide/guide-links";

type HelpGuideButtonProps = {
  /**
   * 開くガイドページのURL。省略した場合、現在のパス（usePathname）から
   * guide-links.ts の対応表で自動解決する（＝共通ヘッダー用の挙動）。
   * 設定画面の個別ボタンのように、常に決まったページを開きたい場合は
   * ここに GUIDE_URLS.xxx を明示的に渡す。
   */
  guideUrl?: string;
  /** ボタンに表示する文言（❔の右に表示） */
  label?: string;
  /** スクリーンリーダー用のaria-label（省略時はlabelから自動生成） */
  ariaLabel?: string;
  /**
   * "header": 共通ヘッダー用。スマホでは❔アイコンのみに縮小する。
   * "inline": 設定画面などの項目そばに置く小さいボタン。常にラベルを表示する。
   */
  variant?: "header" | "inline";
  className?: string;
};

/**
 * 「❔使い方」ボタン＋使い方ガイドモーダルをまとめた再利用可能コンポーネント。
 * 画面遷移・新しいタブは使わず、押すとその場でモーダルを開く。
 */
export function HelpGuideButton({
  guideUrl,
  label = "使い方",
  ariaLabel,
  variant = "inline",
  className = "",
}: HelpGuideButtonProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const resolvedUrl = guideUrl ?? getGuideUrlForPath(pathname);

  const headerClass =
    "inline-flex items-center gap-1.5 min-h-10 sm:min-h-11 px-3 rounded-app border border-navy-dark/30 text-navy-dark text-sm font-bold hover:bg-black/5 active:bg-black/10 transition-colors shrink-0";
  const inlineClass =
    "inline-flex items-center gap-1 min-h-10 px-3 rounded-app border border-navy/15 bg-navy/[0.03] text-navy/70 text-xs font-bold hover:bg-navy/10 active:bg-navy/15 transition-colors shrink-0 whitespace-nowrap";

  const baseClass = variant === "header" ? headerClass : inlineClass;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={ariaLabel ?? `${label}のガイドを開く`}
        className={`${baseClass} ${className}`}
      >
        <span aria-hidden="true">❔</span>
        {variant === "header" ? (
          <span className="hidden sm:inline">{label}</span>
        ) : (
          <span>{label}</span>
        )}
      </button>

      <HelpGuideModal
        open={open}
        onClose={() => setOpen(false)}
        url={resolvedUrl}
        title="MATTY 使い方ガイド"
      />
    </>
  );
}
