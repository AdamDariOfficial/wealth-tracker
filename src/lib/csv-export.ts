/**
 * Minimal but strict CSV builder.
 *
 * - Escapes any field containing "," `"` or newline by wrapping in double
 *   quotes and doubling any inner `"`.
 * - Prepends a UTF-8 BOM so Excel detects encoding correctly.
 * - Uses CRLF line endings (RFC 4180) for max Excel/Sheets compatibility.
 */
export function toCsv<T extends Record<string, unknown>>(
  rows: T[],
  columns: { key: keyof T | string; header: string; format?: (row: T) => string }[],
): string {
  const escape = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "string" ? v : String(v);
    if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const header = columns.map((c) => escape(c.header)).join(",");
  const body = rows
    .map((row) =>
      columns
        .map((c) => escape(c.format ? c.format(row) : (row as Record<string, unknown>)[c.key as string]))
        .join(","),
    )
    .join("\r\n");

  // BOM ensures Excel opens as UTF-8.
  return `\uFEFF${header}\r\n${body}`;
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function csvDateStamp(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}