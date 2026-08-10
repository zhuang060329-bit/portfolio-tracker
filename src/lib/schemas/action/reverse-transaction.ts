import { z } from "zod";

// 撤銷 / 沖銷一筆交易。
//   undo    真刪最新一筆並修正該日快照，只有該帳戶最新一筆能用
//   reverse 保留原筆，另記一筆反向交易；不修正歷史快照
// 型別是否可撤銷由 RPC 判定，這裡只驗證輸入形狀。
export const ReverseTransactionSchema = z.object({
  accountId: z.string().min(1, "缺少帳戶 ID"),
  transactionId: z.string().min(1, "缺少交易 ID"),
  mode: z.enum(["undo", "reverse"], { error: "模式無效" }),
});

export type ReverseTransactionInput = z.infer<typeof ReverseTransactionSchema>;
