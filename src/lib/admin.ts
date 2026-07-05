// Admin 判斷：用 env var ADMIN_EMAILS（逗號分隔）；未設則預設你的 email。
// 之後想加 admin 直接到 Vercel 環境變數加，不用改 code。

// 未設 ADMIN_EMAILS 即無 admin（不 fallback 到寫死信箱，避免 PII 進版控）。
const RAW = process.env.ADMIN_EMAILS ?? "";
export const ADMIN_EMAILS = RAW.split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}
