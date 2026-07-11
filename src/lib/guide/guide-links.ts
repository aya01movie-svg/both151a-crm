/**
 * MATTY 使い方ガイド（public/guide/ 以下）のURLを一元管理するファイル。
 *
 * 各画面のコンポーネントへガイドのURL文字列を直接書かず、
 * 必ずこのファイルの GUIDE_URLS / getGuideUrlForPath 経由で参照すること。
 * （ガイドのファイル構成が変わった場合、この1ファイルだけ直せばよい）
 */

const GUIDE_BASE = "/guide";

/** ガイドのトップ（目次） */
export const GUIDE_INDEX_URL = `${GUIDE_BASE}/index.html`;

/**
 * 実在するガイドページのうち、アプリ内から直接リンクするものの一覧。
 * ファイル名は public/guide/pages/ の実ファイルと完全に一致させること
 * （推測でファイル名を作らない）。
 */
export const GUIDE_URLS = {
  /** 目次（トップ） */
  index: GUIDE_INDEX_URL,
  /** ⑥ 検索窓の使い方 */
  search: `${GUIDE_BASE}/pages/06-search.html`,
  /** ⑫ スタッフの休みを登録する */
  staffOff: `${GUIDE_BASE}/pages/12-staff-off.html`,
  /** おまけ：お知らせに表示するイベントを登録してみよう（通常イベント / event_type="other"） */
  eventGeneral: `${GUIDE_BASE}/pages/18-event.html`,
  /** おまけ②：カレンダーに反映させたいイベントを登録しよう（event_type="calendar"） */
  eventCalendar: `${GUIDE_BASE}/pages/19-calendar-event.html`,
} as const;

/**
 * 共通ヘッダーの「❔使い方」ボタン用：現在のパス（usePathname()の値）に応じて
 * 開くべきガイドページを1箇所で管理する対応表。
 *
 * ここに無いパスは、目次（GUIDE_INDEX_URL）を開く
 * （＝「対応ページが無ければ目次を開く」という仕様どおりの既定動作）。
 */
const PATH_GUIDE_MAP: Record<string, string> = {
  "/search": GUIDE_URLS.search,
};

/** pathname から、共通ヘッダーが開くべきガイドURLを解決する */
export function getGuideUrlForPath(pathname: string | null | undefined): string {
  if (!pathname) return GUIDE_INDEX_URL;
  return PATH_GUIDE_MAP[pathname] ?? GUIDE_INDEX_URL;
}
