-- Batch 2：FX 拆解 PnL + 已歸檔狀態 + 配置目標
-- 在 Supabase SQL Editor 跑。enum 那兩行若同 transaction 跳錯，先單獨跑後再跑剩下。

-- ===== 1) 帳戶歸檔狀態 =====
do $$ begin
  create type account_status as enum ('active', 'archived');
exception when duplicate_object then null;
end $$;

alter table accounts
  add column if not exists status account_status not null default 'active';

-- ===== 2) cost_basis_native (FX 拆解 PnL 用) =====
-- 累計用原幣計算的成本（美股 = 累計付出 USD；台股 / 加密貨幣 / manual = TWD）
alter table accounts
  add column if not exists cost_basis_native numeric(20,8) not null default 0;

-- 回填：對非手動帳戶用 quantity × last_unit_price 推算；對手動 = manual_value_base
update accounts
set cost_basis_native = case
  when price_market = 'manual' then coalesce(manual_value_base, 0)
  else coalesce(quantity, 0) * coalesce(last_unit_price, 0)
end
where cost_basis_native = 0;

-- ===== 3) profiles 加 allocation_targets =====
-- jsonb 結構：{ "stock": 60, "crypto": 30, "other_investment": 10 }
-- 任意 asset_class 都可放 (master prompt 第 4 節的 enum 值)，數字代表目標百分比。
alter table profiles
  add column if not exists allocation_targets jsonb not null default '{}'::jsonb;

-- ===== 4) 通知 PostgREST 重載 schema =====
notify pgrst, 'reload schema';
