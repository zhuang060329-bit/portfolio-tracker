import { z } from "zod";

export const CreateStockAccountSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "請輸入帳戶名稱")
    .max(100, "帳戶名稱不得超過 100 字"),
  market: z.enum(["us", "tw"], { error: () => "請選擇市場（美股 / 台股）" }),
  symbol: z
    .string()
    .trim()
    .min(1, "請輸入 symbol（美股 ticker 或台股代號）"),
  quantity: z.coerce
    .number({ error: "股數需為正數" })
    .positive("股數需為正數")
    .max(100_000_000, "數值過大，請確認輸入"),
});

export type CreateStockAccountInput = z.infer<typeof CreateStockAccountSchema>;

export const CreateCryptoAccountSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "請輸入帳戶名稱")
    .max(100, "帳戶名稱不得超過 100 字"),
  symbol: z
    .string()
    .trim()
    .min(1, "請輸入 CoinGecko id（如 bitcoin）"),
  quantity: z.coerce
    .number({ error: "持有數量需為正數" })
    .positive("持有數量需為正數")
    .max(100_000_000, "數值過大，請確認輸入"),
});

export type CreateCryptoAccountInput = z.infer<typeof CreateCryptoAccountSchema>;

export const CreateManualAccountSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "請輸入帳戶名稱")
    .max(100, "帳戶名稱不得超過 100 字"),
  balance: z.coerce
    .number({ error: "餘額需為非負數" })
    .nonnegative("餘額需為非負數")
    .max(100_000_000, "數值過大，請確認輸入"),
});

export type CreateManualAccountInput = z.infer<typeof CreateManualAccountSchema>;
