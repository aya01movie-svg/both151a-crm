type Column<T> = { key: keyof T; label: string };

function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * CSV出力（第16章：UTF-8形式）。
 * Excelでの文字化けを避けるためBOMを付与する（日本語運用で一般的な対策）。
 */
export function toCsv<T extends Record<string, unknown>>(
  rows: T[],
  columns: Column<T>[]
): string {
  const header = columns.map((c) => escapeCsvCell(c.label)).join(",");
  const body = rows
    .map((row) => columns.map((c) => escapeCsvCell(row[c.key])).join(","))
    .join("\n");
  return "\uFEFF" + header + "\n" + body + "\n";
}

export function csvResponse(csv: string, filename: string): Response {
  const bytes = new TextEncoder().encode(csv);
  return new Response(bytes, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(bytes.byteLength),
      "X-Content-Type-Options": "nosniff",
    },
  });
}
