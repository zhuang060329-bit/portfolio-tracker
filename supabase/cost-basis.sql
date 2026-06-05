-- 為帳戶加上「成本基礎（TWD）」欄位，用來算損益。
-- 損益 = quantity * last_unit_price * last_fx_rate - cost_basis_twd（manual 帳戶 = 0）
-- 執行於 Supabase SQL Editor（在前面 schema 已建好之後）。

alter table accounts
  add column if not exists cost_basis_twd numeric(20,2) not null default 0;

-- 一次性回填：把現有帳戶的 cost 設為「目前估值」，這樣初始 PnL = 0，
-- 之後每次加碼 / 修改餘額會正確累進。
update accounts
set cost_basis_twd = case
  when price_market = 'manual' then coalesce(manual_value_base, 0)
  else coalesce(quantity, 0)
       * coalesce(last_unit_price, 0)
       * coalesce(last_fx_rate, 1)
end
where cost_basis_twd = 0;
