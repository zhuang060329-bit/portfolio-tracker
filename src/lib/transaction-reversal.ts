export type ReversalTarget = {
  id: string;
  type: string;
  cashflow_twd: number | null;
  /** 這一列本身就是沖銷交易 */
  isReversal: boolean;
  /** 這一列已經被另一筆沖銷過 */
  alreadyReversed: boolean;
  /** 這一列是該帳戶最新一筆 */
  isLatest: boolean;
};

/**
 * 判斷這一列能不能撤銷，以及用哪種模式。
 *
 * 規則與 RPC 端一致（supabase/migrations/20260810234500_transaction_reversal.sql）。
 * 這裡的判斷只決定「要不要畫按鈕」，真正的把關在 RPC；兩邊如果漂移，
 * 使用者最多是按下去看到 RPC 的拒絕訊息，不會寫出錯誤資料。
 */
export function reversalMode(t: ReversalTarget): "undo" | "reverse" | null {
  if (t.isReversal || t.alreadyReversed) return null;
  // 建立帳戶要刪整個帳戶；更新報價沒有現金流。
  if (t.type === "create" || t.type === "price_update") return null;
  // 往下調整數量的成本是按比例縮放的，行內資訊不足以回推。
  if (
    t.type === "adjust_quantity" &&
    (t.cashflow_twd === null || Number(t.cashflow_twd) >= 0)
  ) {
    return null;
  }
  // 賣出股數只能從賣出當下的帳戶狀態回推，所以只有最新一筆能撤銷。
  if (t.type === "sell") return t.isLatest ? "undo" : null;
  return t.isLatest ? "undo" : "reverse";
}
