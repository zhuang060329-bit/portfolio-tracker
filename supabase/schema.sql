-- 投資組合追蹤器 — Supabase 資料模型（master prompt 第 4 節，逐字照抄，勿改欄位名稱或型別）
-- 用法：Supabase Dashboard → SQL Editor → New query → 貼上整段 → Run。

-- Enums
create type asset_class as enum (
  'liquid_cash', 'fund', 'stock', 'crypto',
  'precious_metal', 'other_investment',
  'fixed_asset', 'receivable', 'liability'
);
create type price_market as enum ('us', 'tw', 'crypto', 'manual');
create type txn_type as enum (
  'create', 'adjust_quantity', 'adjust_balance', 'price_update'
);

-- profiles：每位使用者一筆，存基準幣別
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  base_currency text not null default 'TWD',
  created_at timestamptz not null default now()
);

-- accounts：每一筆投資帳戶
create table accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  asset_class asset_class not null,
  price_market price_market not null default 'manual',
  symbol text,                                    -- ticker / 股票代號 / coingecko id；manual 為 null
  quantity numeric(20,8) not null default 0,
  native_currency text not null default 'TWD',    -- 價格計價幣別
  last_unit_price numeric(20,8),                  -- 以 native_currency 計
  last_fx_rate numeric(20,8) not null default 1,  -- native_currency -> base_currency
  manual_value_base numeric(20,2),                -- manual 帳戶直接記基準幣別餘額
  last_priced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- transactions：變動記錄（新建、增減股數、修改餘額、價格更新）
create table transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  type txn_type not null,
  quantity_after numeric(20,8),
  unit_price numeric(20,8),
  fx_rate numeric(20,8),
  value_after_base numeric(20,2),
  note text,
  created_at timestamptz not null default now()
);

-- account_snapshots：每帳戶每日一筆，供趨勢圖用
create table account_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  snapshot_date date not null,
  quantity numeric(20,8) not null,
  unit_price numeric(20,8),
  fx_rate numeric(20,8) not null default 1,
  value_base numeric(20,2) not null,
  created_at timestamptz not null default now(),
  unique (account_id, snapshot_date)
);

-- Row Level Security：每位使用者只能存取自己的資料
alter table profiles enable row level security;
alter table accounts enable row level security;
alter table transactions enable row level security;
alter table account_snapshots enable row level security;

create policy "own profile" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "own accounts" on accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own transactions" on transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own snapshots" on account_snapshots
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 新使用者註冊時自動建立 profile
create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
