import { z } from "zod";
import { AlertTypeSchema } from "@/lib/schemas/domain/alert-type";

export const CreateAlertSchema = z
  .object({
    type: AlertTypeSchema,
    threshold: z.coerce
      .number({ error: "閾值必須是數字" })
      .positive("閾值必須大於 0")
      .max(1_000_000_000, "閾值不得超過 10 億"),
    accountId: z.string().uuid("帳戶 ID 格式錯誤").nullable(),
    note: z.string().max(200, "備註不得超過 200 字").nullable(),
  })
  .superRefine((data, ctx) => {
    if (
      (data.type === "price_above" || data.type === "price_below") &&
      !data.accountId
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "價格警示須指定帳戶",
        path: ["accountId"],
      });
    }
  });

export type CreateAlertInput = z.infer<typeof CreateAlertSchema>;
