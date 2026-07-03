/**
 * lib/actions/visits.ts（Server Actionsファイル）から分離。
 * Next.js 16のルール: Server Actionsファイルは async function 以外をエクスポートできない。
 * オブジェクト定数（initialSaveVisitState）と型はこちらの通常モジュールに置く。
 */
export type SaveVisitState = {
  error: string | null;
  success: boolean;
  customerId: string | null;
  intent: "save" | "save_and_continue" | null;
};

export const initialSaveVisitState: SaveVisitState = {
  error: null,
  success: false,
  customerId: null,
  intent: null,
};
