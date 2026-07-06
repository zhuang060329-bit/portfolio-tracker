-- 整合測試用最小 schema（鏡射 production 的 accounts / transactions /
-- account_snapshots 欄位；auth.users 外鍵與 RLS 屬 Supabase 環境，測試不含）。
-- 若正式 schema 欄位變動，此檔需同步——integration test 的欄位斷言會抓漂移。
-- 冪等：可重複套用。

drop table if exists account_snapshots cascade;
drop table if exists transactions cascade;
drop table if exists accounts cascade;
drop type if exists txn_type cascade;
drop type if exists price_market cascade;
drop type if exists asset_class cascade;

create type asset_class as enum ('liquid_cash','fund','stock','crypto','precious_metal','other_investment','fixed_asset','receivable','liability');
create type price_market as enum ('us','tw','crypto','manual');
create type txn_type as enum ('create','adjust_quantity','adjust_balance','price_update','sell','dividend','interest');

create table accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  asset_class asset_class not null,
  price_market price_market not null default 'manual',
  symbol text,
  quantity numeric(20,8) not null default 0,
  native_currency text not null default 'TWD',
  last_unit_price numeric(20,8),
  last_fx_rate numeric(20,8) not null default 1,
  manual_value_base numeric(20,2),
  last_priced_at timestamptz,
  cost_basis_twd numeric(20,2) not null default 0,
  cost_basis_native numeric(20,8) not null default 0,
  realized_pnl_twd numeric(20,2) not null default 0,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  account_id uuid not null references accounts(id) on delete cascade,
  type txn_type not null,
  quantity_after numeric(20,8),
  unit_price numeric(20,8),
  fx_rate numeric(20,8),
  value_after_base numeric(20,2),
  note text,
  created_at timestamptz not null default now(),
  cashflow_twd numeric(20,2),
  realized_pnl numeric(20,2)
);

create table account_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  account_id uuid not null references accounts(id) on delete cascade,
  snapshot_date date not null,
  quantity numeric(20,8) not null,
  unit_price numeric(20,8),
  fx_rate numeric(20,8) not null default 1,
  value_base numeric(20,2) not null,
  created_at timestamptz not null default now(),
  unique (account_id, snapshot_date)
);
