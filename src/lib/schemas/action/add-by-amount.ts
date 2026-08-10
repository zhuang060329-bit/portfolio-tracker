import { z } from "zod";

export const AddByAmountSchema = z.object({
  accountId: z.string().min(1, "缺少帳戶 ID"),
  twd: z.coerce
    .number({ error: "投入金額必須是數字" })
    .positive("投入金額需為正數 TWD")
    .max(100_000_000, "投入金額不得超過 1 億"),
  // 費用內含：twd 是總支出，feeTwd 是其中被券商收走的部分。
  // null = 未填，交易記為「未記錄手續費」而不是 0。
  feeTwd: z.coerce
    .number({ error: "手續費必須是數字" })
    .nonnegative("手續費不得為負數")
    .max(100_000_000, "手續費不得超過 1 億")
    .nullable(),
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
    .refine(
      (s) => {
        if (isNaN(new Date(s).getTime())) return true;
        const todayInTaipei = new Date().toLocaleDateString("en-CA", {
          timeZone: "Asia/Taipei",
        });
        return s.slice(0, 10) <= todayInTaipei;
      },
      { message: "時間不得為未來日期" },
    )
    .nullable(),
  note: z.string().max(200, "備註不得超過 200 字").nullable(),
}).refine((v) => v.feeTwd === null || v.feeTwd < v.twd, {
  message: "手續費不得大於或等於投入金額",
  path: ["feeTwd"],
});

export type AddByAmountInput = z.infer<typeof AddByAmountSchema>;
