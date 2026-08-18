-- 沖銷列允許負數手續費。
--
-- 為什麼要改：20260810230000_transaction_fee.sql 建 fee_twd 時寫的是
--   check (fee_twd is null or fee_twd >= 0)
-- 而 45 分鐘後的 20260810234500_transaction_reversal.sql，沖銷時寫的是
--   case when v_txn.fee_twd is null then null else -v_txn.fee_twd end
-- 兩者直接矛盾。結果是「沖銷較早的一筆」只要原始交易記過手續費，
-- 就會被 transactions_fee_twd_check 擋下並整筆 rollback：
--   new row for relation "transactions" violates check constraint
--   "transactions_fee_twd_check"
-- 這在 v1.1.0 上線時就存在。CI 的整合測試本來會抓到，但 Gate 4 從那天起
-- 每次都死在 setup（三支測試共用同一個 Postgres 而不清 schema），所以沒人看見。
--
-- 為什麼選「放寬約束」而不是「沖銷列寫 0」：
-- 沖銷列是一筆 contra entry，它的 cashflow_twd 與 realized_pnl 早就是負的，
-- 手續費跟著變號才一致，一正一負在帳戶明細與匯出 CSV 裡剛好互相抵銷。
-- 若改寫 0，原筆的手續費會永遠掛著沖不掉。
--
-- 一般流水仍不得為負：只有 reversal_of 非 null 的列例外。
-- reversal_of 與 fee_twd 在同一個 insert 裡給值，CHECK 是整列成形後才評估，
-- 所以沖銷列自己就滿足條件。

alter table public.transactions
  drop constraint if exists transactions_fee_twd_check;

alter table public.transactions
  add constraint transactions_fee_twd_check
  check (fee_twd is null or fee_twd >= 0 or reversal_of is not null);

notify pgrst, 'reload schema';
