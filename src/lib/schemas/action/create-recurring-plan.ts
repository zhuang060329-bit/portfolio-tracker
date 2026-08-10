import { z } from "zod";

export const CreateRecurringPlanSchema = z.object({
  accountId: z.string().min(1, "缺少帳戶 ID"),
  amount: z.coerce
    .number({ error: "金額必須是數字" })
    .positive("金額需為正數")
    .max(100_000_000, "金額不得超過 1 億"),
  // 每期固定手續費。這是計劃設定值不是歷史紀錄，沒填就是 0（= 這個計劃沒有手續費）。
  fee: z.coerce
    .number({ error: "手續費必須是數字" })
    .nonnegative("手續費不得為負數")
    .max(100_000_000, "手續費不得超過 1 億")
    .default(0),
  dayOfMonth: z.coerce
    .number({ error: "扣款日必須是數字" })
    .int("扣款日必須是整數")
    .min(1, "扣款日必須介於 1 到 28 之間")
    .max(28, "扣款日必須介於 1 到 28 之間"),
  startDate: z
    .string()
    .refine((s) => !isNaN(new Date(s).getTime()), { message: "起始日期格式錯誤" })
    .nullable(),
  note: z.string().max(200, "備註不得超過 200 字").nullable(),
}).refine((v) => v.fee < v.amount, {
  message: "手續費不得大於或等於每次金額",
  path: ["fee"],
});

export type CreateRecurringPlanInput = z.infer<typeof CreateRecurringPlanSchema>;
