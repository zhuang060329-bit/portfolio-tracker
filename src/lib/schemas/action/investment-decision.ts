import { z } from "zod";

const dateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式不正確");

const optionalUuid = z.preprocess(
  (value) => (value === "" || value == null ? undefined : value),
  z.uuid("關聯資料格式不正確").optional(),
);

const optionalNumber = (min: number, max: number, message: string) =>
  z.preprocess(
    (value) => (value === "" || value == null ? undefined : value),
    z.coerce.number({ error: message }).min(min, message).max(max, message).optional(),
  );

export const InvestmentDecisionSchema = z
  .object({
    accountId: optionalUuid,
    transactionId: optionalUuid,
    decisionDate: dateField,
    assetName: z.string().trim().min(1, "請填寫標的").max(120, "標的名稱過長"),
    symbol: z.string().trim().max(40, "代號過長").optional().default(""),
    decisionType: z.enum(["buy", "add", "reduce", "sell", "hold", "avoid"]),
    thesis: z.string().trim().min(1, "請填寫投資論點").max(4000, "投資論點過長"),
    catalysts: z.string().trim().max(3000, "催化劑內容過長").optional().default(""),
    risks: z.string().trim().min(1, "請填寫主要風險").max(3000, "風險內容過長"),
    invalidationConditions: z
      .string()
      .trim()
      .min(1, "請填寫失效條件")
      .max(3000, "失效條件過長"),
    expectedHoldingMonths: z.coerce
      .number({ error: "持有期間必須是數字" })
      .int("持有期間必須是整數月")
      .min(1, "持有期間至少 1 個月")
      .max(600, "持有期間最多 600 個月"),
    targetReturnMinPct: optionalNumber(-100, 10000, "最低目標報酬格式不正確"),
    targetReturnMaxPct: optionalNumber(-100, 10000, "最高目標報酬格式不正確"),
    maxDrawdownPct: optionalNumber(0, 100, "最大可接受跌幅須介於 0 到 100"),
    confidence: z.coerce.number().int().min(1).max(3),
    reviewDate: dateField,
    tags: z.string().trim().max(400, "標籤內容過長").optional().default(""),
  })
  .superRefine((value, ctx) => {
    if (value.reviewDate < value.decisionDate) {
      ctx.addIssue({
        code: "custom",
        path: ["reviewDate"],
        message: "檢討日期不可早於決策日期",
      });
    }
    if (
      value.targetReturnMinPct != null &&
      value.targetReturnMaxPct != null &&
      value.targetReturnMinPct > value.targetReturnMaxPct
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["targetReturnMaxPct"],
        message: "最高目標報酬不可低於最低值",
      });
    }
    const tags = parseDecisionTags(value.tags);
    if (tags.length > 12) {
      ctx.addIssue({
        code: "custom",
        path: ["tags"],
        message: "標籤最多 12 個",
      });
    }
  });

export const DecisionReviewSchema = z.object({
  hypothesisOutcome: z
    .string()
    .trim()
    .min(1, "請填寫假設結果")
    .max(3000, "假設結果過長"),
  catalystOutcome: z.string().trim().max(3000, "催化劑結果過長").optional().default(""),
  riskOutcome: z.string().trim().max(3000, "風險結果過長").optional().default(""),
  planFollowed: z.enum(["true", "false"]).transform((value) => value === "true"),
  assetReturnPct: optionalNumber(-100, 100000, "標的報酬格式不正確"),
  twdReturnPct: optionalNumber(-100, 100000, "TWD 報酬格式不正確"),
  fxEffectPct: optionalNumber(-100, 100000, "匯率效果格式不正確"),
  maxFavorableExcursionPct: optionalNumber(-100, 100000, "最大有利變動格式不正確"),
  maxAdverseExcursionPct: optionalNumber(-100, 100000, "最大不利變動格式不正確"),
  decisionQuality: z.coerce.number().int().min(1).max(3),
  reflection: z.string().trim().min(1, "請填寫檢討內容").max(4000, "檢討內容過長"),
  nextImprovement: z
    .string()
    .trim()
    .min(1, "請填寫下次改進事項")
    .max(2000, "改進事項過長"),
});

export function parseDecisionTags(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[,，]/)
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  );
}

export type InvestmentDecisionInput = z.infer<typeof InvestmentDecisionSchema>;
export type DecisionReviewInput = z.infer<typeof DecisionReviewSchema>;
