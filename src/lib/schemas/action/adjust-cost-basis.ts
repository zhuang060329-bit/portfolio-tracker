import { z } from "zod";

export const AdjustCostBasisSchema = z.object({
  accountId: z.string().min(1, "缺少帳戶 ID"),
  // 帳戶原幣的總成本（不是均價）。TWD 帳戶只填這一欄。
  costNative: z.coerce
    .number({ error: "總成本必須是數字" })
    .positive("總成本需為正數")
    .max(100_000_000_000, "總成本超出可接受範圍"),
  // 外幣帳戶的 TWD 總成本。null = 留空，由帳戶現有的平均成本匯率換算。
  costTwd: z.coerce
    .number({ error: "TWD 總成本必須是數字" })
    .positive("TWD 總成本需為正數")
    .max(100_000_000_000, "TWD 總成本超出可接受範圍")
    .nullable(),
  note: z.string().max(200, "備註不得超過 200 字").nullable(),
});

export type AdjustCostBasisInput = z.infer<typeof AdjustCostBasisSchema>;
