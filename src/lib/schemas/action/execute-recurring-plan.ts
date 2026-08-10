import { z } from "zod";

// 手動執行定期定額。amount / fee 省略 = 沿用計劃的預設值；
// 有值 = 本期覆寫（漲了減碼、跌了加碼；當期券商實收費用不同），計劃預設值不變。
// 規則與 CreateRecurringPlanSchema 一致。
export const ExecuteRecurringPlanSchema = z.object({
  planId: z.string().min(1, "缺少計劃 ID"),
  amount: z.coerce
    .number({ error: "金額必須是數字" })
    .positive("金額需為正數")
    .max(100_000_000, "金額不得超過 1 億")
    .optional(),
  fee: z.coerce
    .number({ error: "手續費必須是數字" })
    .nonnegative("手續費不得為負數")
    .max(100_000_000, "手續費不得超過 1 億")
    .optional(),
});

export type ExecuteRecurringPlanInput = z.infer<
  typeof ExecuteRecurringPlanSchema
>;
