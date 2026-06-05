// 回傳 Asia/Taipei 時區的今日 YYYY-MM-DD（用 en-CA locale 取得 ISO 格式日期字串）。
export function todayTaipei(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
}
