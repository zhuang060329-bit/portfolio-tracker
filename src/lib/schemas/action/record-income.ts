import { z } from "zod";

export const RecordIncomeSchema = z.object({
  accountId: z.string().min(1, "缺少帳戶 ID"),
  amount: z.coerce
    .number({ error: "金額必須是數字" })
    .positive("金額需為正數")
    .max(100_000_000, "金額不得超過 1 億"),
  occurredAt: z
    .string()
    .refine((s) => !isNaN(new Date(s).getTime()), { message: "時間格式無效" })
    .nullable(),
  note: z.string().max(200, "備註不得超過 200 字").nullable(),
});

export type RecordIncomeInput = z.infer<typeof RecordIncomeSchema>;
