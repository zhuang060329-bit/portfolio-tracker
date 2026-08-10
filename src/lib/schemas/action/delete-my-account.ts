import { z } from "zod";

// 刪除自己的帳戶：唯一欄位是使用者手打的 email，作為不可逆操作的防呆。
// 這裡只驗證「有填、長度合理」，是否與登入帳號相符在 server action 內比對，
// 因為 schema 拿不到 session。
export const DeleteMyAccountSchema = z.object({
  confirmEmail: z
    .string({ error: "請輸入你的 email 以確認" })
    .trim()
    .min(1, "請輸入你的 email 以確認")
    .max(320, "email 長度不正確"),
});

export type DeleteMyAccountInput = z.infer<typeof DeleteMyAccountSchema>;
