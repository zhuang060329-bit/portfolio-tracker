-- Batch 1：賣出 / 配息 / 利息 / XIRR 用的 schema 擴充。
-- 在 Supabase SQL Editor 跑。若 ALTER TYPE 與後面 update 同 transaction 失敗，
-- 把這檔分兩次跑（先跑 ALTER TYPE，再跑剩下）。

-- 1) txn_type 加三個新值
alter type txn_type add value if not exists 'sell';
alter type txn_type add value if not exists 'dividend';
alter type txn_type add value if not exists 'interest';

-- 2) accounts 加累計已實現損益（含售出實現 + 配息 + 利息）
alter table accounts
  add column if not exists realized_pnl_twd numeric(20,2) not null default 0;

-- 3) transactions 加：本筆已實現損益（sell / dividend / interest 用）+ 帳戶現金流（XIRR 用）
alter table transactions
  add column if not exists realized_pnl numeric(20,2),
  add column if not exists cashflow_twd numeric(20,2);

-- 4) 回填：create 視為一筆「投入現金流」（負值 = 流出）
update transactions
set cashflow_twd = -value_after_base
where type = 'create' and cashflow_twd is null;

-- 5) 回填：price_update 沒有現金流
update transactions
set cashflow_twd = 0
where type = 'price_update' and cashflow_twd is null;

-- 6) 加碼 / 調整數量 / 調整餘額 的歷史 cashflow 無法可靠回推（需要前後 diff），
--    留 null，XIRR 計算會自動跳過。新加碼之後 server actions 會正確寫入。
