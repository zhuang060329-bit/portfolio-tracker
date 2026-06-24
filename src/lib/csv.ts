const FORMULA_PREFIX = /^[\t\r\n ]*[=+\-@]/;

export function escapeCsvCell(value: string | null | undefined): string {
  if (value === null || value === undefined) return "";

  const raw = String(value);
  // Excel 會將公式前綴視為可執行公式；前置單引號會強制以文字匯入。
  const safe = FORMULA_PREFIX.test(raw) ? `'${raw}` : raw;
  return /[",\n\r]/.test(safe)
    ? `"${safe.replace(/"/g, '""')}"`
    : safe;
}
