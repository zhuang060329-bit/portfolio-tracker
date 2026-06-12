import { z } from "zod";

export const AddByAmountSchema = z.object({
  accountId: z.string().min(1, "缺少帳戶 ID"),
  twd: z.coerce
    .number({ error: "投入金額必須是數字" })
    .positive("投入金額需為正數 TWD")
    .max(100_000_000, "投入金額不得超過 1 億"),
  priceOverride: z.coerce
    .number({ error: "成交價必須是數字" })
    .positive("成交價需為正數")
    .max(1_000_000_000, "成交價不得超過 10 億")
    .nullable(),
  fxOverride: z.coerce
    .number({ error: "匯率必須是數字" })
    .positive("匯率需為正數")
    .max(1_000, "匯率不得超過 1000")
    .nullable(),
  occurredAt: z
    .string()
    .refine((s) => !isNaN(new Date(s).getTime()), { message: "時間格式無效" })
    .nullable(),
  note: z.string().max(200, "備註不得超過 200 字").nullable(),
});

export type AddByAmountInput = z.infer<typeof AddByAmountSchema>;
