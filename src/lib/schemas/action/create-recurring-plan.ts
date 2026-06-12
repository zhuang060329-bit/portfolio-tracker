import { z } from "zod";

export const CreateRecurringPlanSchema = z.object({
  accountId: z.string().min(1, "缺少帳戶 ID"),
  amount: z.coerce
    .number({ error: "金額必須是數字" })
    .positive("金額需為正數")
    .max(100_000_000, "金額不得超過 1 億"),
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
});

export type CreateRecurringPlanInput = z.infer<typeof CreateRecurringPlanSchema>;
