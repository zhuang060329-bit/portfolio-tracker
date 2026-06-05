// Admin 判斷：用 env var ADMIN_EMAILS（逗號分隔）；未設則預設你的 email。
// 之後想加 admin 直接到 Vercel 環境變數加，不用改 code。

const RAW = process.env.ADMIN_EMAILS ?? "zhuang060329@gmail.com";
export const ADMIN_EMAILS = RAW.split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}
