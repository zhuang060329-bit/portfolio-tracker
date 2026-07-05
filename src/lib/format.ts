// 顯示層格式化（純呈現，無任何計算邏輯）。
// Direction A 數字系統的單一來源：同一情境用同一規則，避免「4萬」與「−4,027」混用。
//
// 規則：
// - fmtFull：全位數千分位 → hero 主數字、副指標、表格明細
// - fmtCompact：萬/億緊湊（萬帶 1 位小數避免相鄰刻度塌成同字）→ 圖表軸、donut 中心、緊湊情境
// - fmtUpdatedAt：報價時間，台北時區、人類可讀

export const fmtFull = (n: number) => Math.round(n).toLocaleString("en-US");

export function fmtCompact(n: number): string {
  const a = Math.abs(n);
  const s = n < 0 ? "−" : "";
  if (a >= 1e8) return s + (a / 1e8).toFixed(2) + "億";
  if (a >= 1e4) return s + (a / 1e4).toFixed(1) + "萬";
  return s + Math.round(a).toLocaleString("en-US");
}

// 最多 max 位小數；null 或非有限值回傳 "—"
export const fmtNum = (n: number | null, max = 8): string =>
  n === null || !Number.isFinite(Number(n))
    ? "—"
    : Number(n).toLocaleString("en-US", { maximumFractionDigits: max });

// last_priced_at（ISO，UTC）→「2026-06-11 14:03」（Asia/Taipei）
export function fmtUpdatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const date = d.toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
  const time = d.toLocaleTimeString("en-GB", {
    timeZone: "Asia/Taipei",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${date} ${time}`;
}
