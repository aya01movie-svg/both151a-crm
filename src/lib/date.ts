/** 最終来店からの経過日数（第6章「最終来店からの日数」） */
export function daysSince(isoDateString: string): number {
  const then = new Date(isoDateString).getTime();
  const now = Date.now();
  return Math.max(0, Math.floor((now - then) / (1000 * 60 * 60 * 24)));
}

/** YYYY/MM/DD 表示 */
/**
 * RC9修正: これまで d.getFullYear() / d.getHours() 等のローカルタイムゾーン
 * getterを使っていたため、サーバーのタイムゾーン設定（多くの場合UTC）に
 * 依存して日本時間とズレて表示されていた（来店履歴・予約一覧等すべてに影響）。
 * サーバーの実行環境に関わらず常に日本時間（UTC+9固定）で表示する。
 */
export function formatDate(isoDateString: string | null | undefined): string {
  if (!isoDateString) return "-";
  // 日付のみ（YYYY-MM-DD、例：ボトル期限日）はタイムゾーン変換不要のためそのまま整形する
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoDateString)) {
    const [y, m, d] = isoDateString.split("-");
    return `${y}/${m}/${d}`;
  }
  return toJstDateString(isoDateString).replace(/-/g, "/");
}

/** YYYY/MM/DD HH:mm 表示（来店日時など・日本時間固定） */
export function formatDateTime(isoDateString: string | null | undefined): string {
  if (!isoDateString) return "-";
  return `${formatDate(isoDateString)} ${toJstTimeString(isoDateString)}`;
}

/** <input type="datetime-local"> 用の値（ローカルタイムゾーン基準） */
export function toDateTimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

/**
 * RC8修正: DBのtimestamptzはUTCで返るため、文字列を単純にslice(0,10)すると
 * 日本時間の日付とズレる（早朝の来店・予約が前日扱いになる等）。
 * 日本時間（Asia/Tokyo, UTC+9固定）を基準に YYYY-MM-DD / HH:mm を求める。
 */
export function toJstDateString(isoString: string): string {
  const date = new Date(isoString);
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${jst.getUTCFullYear()}-${pad(jst.getUTCMonth() + 1)}-${pad(jst.getUTCDate())}`;
}

export function toJstTimeString(isoString: string): string {
  const date = new Date(isoString);
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(jst.getUTCHours())}:${pad(jst.getUTCMinutes())}`;
}

/** 指定した日本時間の日付(YYYY-MM-DD)に対応するUTC範囲の開始・終了ISO文字列を返す（DBクエリ用）。 */
export function jstDateRangeToUtcIso(dateStr: string): { startIso: string; endIso: string } {
  // 日本時間 00:00:00 は UTC-9時間、つまり前日15:00 UTC
  const start = new Date(`${dateStr}T00:00:00+09:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

/**
 * RC9修正: <input type="datetime-local"> の値（例: "2026-07-27T16:58"）には
 * タイムゾーン情報が無いため、そのままtimestamptzカラムへ渡すとPostgres側の
 * セッションタイムゾーン（多くの場合UTC）で解釈されてしまい、日本時間として
 * 入力した時刻が9時間ズレて保存される（＋表示側で更に+9時間するため二重にズレる）。
 * ここで明示的に +09:00 を付与し、正しいUTC瞬間に変換してから送信する。
 */
export function jstLocalToUtcIso(localDateTimeValue: string): string {
  // "YYYY-MM-DDTHH:mm" 形式を想定。秒がある場合もそのまま利用する。
  const withOffset = `${localDateTimeValue}+09:00`;
  const date = new Date(withOffset);
  if (Number.isNaN(date.getTime())) {
    // 想定外の形式が来た場合は現在時刻にフォールバックする（保存自体を止めない）
    return new Date().toISOString();
  }
  return date.toISOString();
}

export function yen(n: number): string {
  return `¥${n.toLocaleString("ja-JP")}`;
}
