import { z } from "zod";

export const AlertTypeSchema = z.enum(
  ["price_above", "price_below", "allocation_drift"],
  { error: () => "未知警示類型" },
);

export type AlertType = z.infer<typeof AlertTypeSchema>;
