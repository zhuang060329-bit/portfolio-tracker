/**
 * CSV 匯入用的小工具：欄位嗅探、類型別名、日期容錯。
 * 抽出來方便單元測試（"use server" 檔不能 export 非 async function）。
 */

export const HEADER_ALIASES: Record<
  "date" | "account" | "type" | "amount" | "note",
  string[]
> = {
  date: ["date", "日期", "成交日", "交易日", "datetime", "時間"],
  account: ["account", "帳戶", "帳戶名稱", "標的", "symbol", "代號"],
  type: ["type", "類型", "類別", "種類"],
  amount: [
    "amount_twd",
    "amount",
    "金額",
    "金額(twd)",
    "金額(ntd)",
    "twd",
    "金額_twd",
  ],
  note: ["note", "備註", "說明", "memo"],
};

export function findHeaderIndex(header: string[], candidates: string[]): number {
  for (const c of candidates) {
    const i = header.indexOf(c);
    if (i >= 0) return i;
  }
  return -1;
}

export function normalizeType(raw: string): "dividend" | "interest" | null {
  const s = raw.trim().toLowerCase();
  if (
    s === "dividend" ||
    s === "div" ||
    s === "配息" ||
    s === "股息" ||
    s === "息收"
  )
    return "dividend";
  if (
    s === "interest" ||
    s === "int" ||
    s === "利息" ||
    s === "存款利息"
  )
    return "interest";
  return null;
}

// 金額欄位可能含千分位逗號、NT$、$、空白等，先洗一次再 Number()
export function parseAmount(raw: string): number {
  const cleaned = raw.trim().replace(/[,\s$NT￥]/g, "");
  return Number(cleaned);
}

// 接受多種日期寫法：ISO 2025-05-01、2025/5/1、5/1/2025、2025.5.1
export function parseFlexibleDate(raw: string): Date | null {
  const s = raw.trim();
  if (!s) return null;
  const d1 = new Date(s);
  if (!Number.isNaN(d1.getTime())) return d1;
  const norm = s.replace(/[./]/g, "-");
  const d2 = new Date(norm);
  if (!Number.isNaN(d2.getTime())) return d2;
  const m = norm.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m) {
    const d3 = new Date(
      `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`,
    );
    if (!Number.isNaN(d3.getTime())) return d3;
  }
  return null;
}
