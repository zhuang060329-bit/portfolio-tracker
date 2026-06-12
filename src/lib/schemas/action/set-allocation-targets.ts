import { z } from "zod";

export const SetAllocationTargetsSchema = z
  .record(
    z.string().min(1),
    z.coerce
      .number({ error: "配置目標必須是有效數字" })
      .nonnegative("每個配置目標必須介於 0 到 100 之間")
      .max(100, "每個配置目標必須介於 0 到 100 之間"),
  )
  .superRefine((targets, ctx) => {
    const sum = Object.values(targets).reduce((a, b) => a + b, 0);
    if (sum > 100 + 1e-9) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `配置目標總和不可超過 100%（目前 ${(Math.round(sum * 10) / 10).toFixed(1)}%）`,
      });
    }
  });

export type SetAllocationTargetsInput = z.infer<typeof SetAllocationTargetsSchema>;
