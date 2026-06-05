-- 定期定額計劃。執行於 Supabase SQL Editor（在已執行 schema.sql 之後）。
-- v1 僅支援月頻：每月 day_of_month（1-28，避免月底/閏月處理）執行一次。

create table recurring_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  amount_twd numeric(20,2) not null check (amount_twd > 0),
  day_of_month int not null check (day_of_month between 1 and 28),
  start_date date not null,
  next_run_date date not null,
  last_run_date date,
  active boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table recurring_plans enable row level security;

create policy "own recurring plans" on recurring_plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
