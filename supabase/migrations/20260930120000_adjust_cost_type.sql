-- 交易型別加 adjust_cost（校正成本）。
--
-- 為什麼要加：新建帳戶時成本基礎固定等於建立當下的市值
-- （src/app/accounts/new/actions.ts），既有部位搬進來之後，成本與券商對不上，
-- 而 app 裡沒有任何入口能直接改成本：
--   覆寫數量  往上調以當日報價計成本、往下調按比例縮成本
--   CSV 匯入  部位異動只能匯進尚無交易的帳戶
-- 所以加一個只改 accounts.cost_basis_twd / cost_basis_native 的操作，
-- 並在流水留一筆 adjust_cost，cashflow_twd 記 0。
--
-- 為什麼不沿用 adjust_quantity：
-- adjust_quantity 在 reverse_transaction_mutation 裡會依 cashflow_twd 回推股數，
-- 在 What-if 的投入查詢、TWR 的現金流裡也都有語意。拿它記「只改成本」，
-- 之後每個讀流水的地方都得再用 note 分辨一次。
--
-- 這個 migration 只加 enum 值，不改任何函式：
--   apply_account_mutation        以 (p_transaction->>'type')::txn_type 轉型，新值直接可用
--   reverse_transaction_mutation  未知型別落在 else 分支，raise '這個交易型別不支援撤銷'
--                                 校正成本填錯時再校正一次即可，不提供撤銷
--
-- 執行順序：要在使用 adjust_cost 的程式部署之前跑。
-- 沒跑的話「校正成本」表單送出會收到
--   invalid input value for enum txn_type: "adjust_cost"
-- 整筆 rollback，不會寫出半套資料。
--
-- alter type ... add value 不能與「使用新值的語句」放在同一個 transaction；
-- 這個檔案裡沒有使用新值的語句，可以整個貼進 SQL Editor 一次跑完。

alter type public.txn_type add value if not exists 'adjust_cost';

notify pgrst, 'reload schema';
