-- 帳務寫入 RPC。函式使用 security invoker，使用者端依既有 RLS 限制資料範圍；
-- cron 的 service role 仍可跨使用者執行。任一步失敗時，Postgres 交易會整體回滾。
-- 套用方式：Supabase Dashboard → SQL Editor → 貼上全文 → Run。

create or replace function public.apply_account_mutation(
  p_account_id uuid,
  p_account_patch jsonb default '{}'::jsonb,
  p_transaction jsonb default null,
  p_snapshots jsonb default '[]'::jsonb
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid;
  snap jsonb;
begin
  select user_id into v_user_id from accounts where id = p_account_id;
  if v_user_id is null then
    raise exception '帳戶不存在或無權限';
  end if;

  update accounts set
    quantity          = coalesce((p_account_patch->>'quantity')::numeric, quantity),
    cost_basis_twd    = coalesce((p_account_patch->>'cost_basis_twd')::numeric, cost_basis_twd),
    cost_basis_native = coalesce((p_account_patch->>'cost_basis_native')::numeric, cost_basis_native),
    realized_pnl_twd  = coalesce((p_account_patch->>'realized_pnl_twd')::numeric, realized_pnl_twd),
    last_unit_price   = coalesce((p_account_patch->>'last_unit_price')::numeric, last_unit_price),
    last_fx_rate      = coalesce((p_account_patch->>'last_fx_rate')::numeric, last_fx_rate),
    last_priced_at    = coalesce((p_account_patch->>'last_priced_at')::timestamptz, last_priced_at),
    manual_value_base = coalesce((p_account_patch->>'manual_value_base')::numeric, manual_value_base),
    updated_at        = now()
  where id = p_account_id;

  if p_transaction is not null then
    insert into transactions (
      user_id, account_id, type, quantity_after, unit_price,
      fx_rate, value_after_base, note, created_at, cashflow_twd, realized_pnl
    ) values (
      v_user_id,
      p_account_id,
      (p_transaction->>'type')::txn_type,
      (p_transaction->>'quantity_after')::numeric,
      (p_transaction->>'unit_price')::numeric,
      (p_transaction->>'fx_rate')::numeric,
      (p_transaction->>'value_after_base')::numeric,
      p_transaction->>'note',
      coalesce((p_transaction->>'created_at')::timestamptz, now()),
      (p_transaction->>'cashflow_twd')::numeric,
      (p_transaction->>'realized_pnl')::numeric
    );
  end if;

  for snap in select * from jsonb_array_elements(p_snapshots) loop
    insert into account_snapshots (
      user_id, account_id, snapshot_date, quantity, unit_price, fx_rate, value_base
    ) values (
      v_user_id,
      p_account_id,
      (snap->>'snapshot_date')::date,
      (snap->>'quantity')::numeric,
      (snap->>'unit_price')::numeric,
      coalesce((snap->>'fx_rate')::numeric, 1),
      (snap->>'value_base')::numeric
    )
    on conflict (account_id, snapshot_date) do update set
      quantity   = excluded.quantity,
      unit_price = excluded.unit_price,
      fx_rate    = excluded.fx_rate,
      value_base = excluded.value_base;
  end loop;
end;
$$;

-- 每個 plan 的每個 scheduled_date 最多只能成功執行一次。ledger 只記錄已提交成功的執行；
-- 若帳戶、流水、快照或排程推進任一步失敗，ledger 列也會一併回滾。
create table if not exists public.recurring_plan_runs (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.recurring_plans(id) on delete cascade,
  user_id uuid not null,
  account_id uuid not null references public.accounts(id) on delete cascade,
  scheduled_date date not null,
  executed_date date not null,
  executed_at timestamptz not null,
  source text not null check (source in ('cron', 'manual')),
  amount_twd numeric(20,2) not null check (amount_twd > 0),
  shares_added numeric(20,8) not null check (shares_added > 0),
  unit_price numeric(20,8) not null check (unit_price > 0),
  fx_rate numeric(20,8) not null check (fx_rate > 0),
  transaction_id uuid references public.transactions(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (plan_id, scheduled_date)
);

create index if not exists recurring_plan_runs_user_executed_idx
  on public.recurring_plan_runs (user_id, executed_at desc);

alter table public.recurring_plan_runs enable row level security;

do $policies$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'recurring_plan_runs'
      and policyname = 'recurring_plan_runs_select_own'
  ) then
    execute 'create policy recurring_plan_runs_select_own on public.recurring_plan_runs for select using (auth.uid() = user_id)';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'recurring_plan_runs'
      and policyname = 'recurring_plan_runs_insert_own'
  ) then
    execute 'create policy recurring_plan_runs_insert_own on public.recurring_plan_runs for insert with check (auth.uid() = user_id)';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'recurring_plan_runs'
      and policyname = 'recurring_plan_runs_update_own'
  ) then
    execute 'create policy recurring_plan_runs_update_own on public.recurring_plan_runs for update using (auth.uid() = user_id) with check (auth.uid() = user_id)';
  end if;
end
$policies$;

-- 最新報價在 RPC 外取得；帳戶增量、流水、快照、ledger 與排程日期在同一交易內完成。
-- plan 與 account 都以 row lock 串行化，避免同一排程重複執行及同帳戶並行加碼互相覆寫。
create or replace function public.execute_recurring_plan_mutation(
  p_plan_id uuid,
  p_expected_run_date date,
  p_executed_at timestamptz,
  p_unit_price numeric,
  p_fx_rate numeric,
  p_priced_at timestamptz,
  p_source text default 'cron'
) returns table (
  executed boolean,
  shares_added numeric,
  new_quantity numeric,
  next_run_date date
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_plan public.recurring_plans%rowtype;
  v_account public.accounts%rowtype;
  v_run_id uuid;
  v_transaction_id uuid;
  v_execution_date date;
  v_next_month date;
  v_next_run_date date;
  v_shares_added numeric;
  v_new_quantity numeric;
  v_new_cost_twd numeric;
  v_new_cost_native numeric;
  v_value_after numeric;
  v_note text;
begin
  if p_source not in ('cron', 'manual') then
    raise exception '執行來源無效';
  end if;
  if p_expected_run_date is null or p_executed_at is null or p_priced_at is null then
    raise exception '排程日期或報價時間缺失';
  end if;
  if p_unit_price is null or p_unit_price <= 0 or p_fx_rate is null or p_fx_rate <= 0 then
    raise exception '成交價或匯率無效';
  end if;

  v_execution_date := (p_executed_at at time zone 'Asia/Taipei')::date;

  select * into v_plan
  from public.recurring_plans
  where id = p_plan_id
  for update;

  if not found then
    raise exception '計劃不存在或無權限';
  end if;
  if not v_plan.active then
    raise exception '計劃已暫停';
  end if;
  if p_source = 'cron' and p_expected_run_date > v_execution_date then
    raise exception '計劃尚未到執行日';
  end if;

  -- stale caller 或並行重試：plan 已被前一交易推進，直接回傳未執行。
  if v_plan.next_run_date <> p_expected_run_date then
    return query select false, null::numeric, null::numeric, v_plan.next_run_date;
    return;
  end if;

  select * into v_account
  from public.accounts
  where id = v_plan.account_id
  for update;

  if not found or v_account.user_id <> v_plan.user_id then
    raise exception '帳戶不存在、無權限或擁有者不一致';
  end if;
  if v_account.status = 'archived' then
    raise exception '帳戶已歸檔';
  end if;
  if v_account.price_market = 'manual' or v_account.symbol is null then
    raise exception '手動帳戶無法執行定期定額';
  end if;
  if v_plan.amount_twd is null or v_plan.amount_twd <= 0 then
    raise exception '定期定額金額無效';
  end if;

  v_shares_added := v_plan.amount_twd / (p_unit_price * p_fx_rate);
  if v_shares_added <= 0 then
    raise exception '換算股數無效';
  end if;

  v_new_quantity := v_account.quantity + v_shares_added;
  v_new_cost_twd := v_account.cost_basis_twd + v_plan.amount_twd;
  v_new_cost_native := v_account.cost_basis_native + (v_plan.amount_twd / p_fx_rate);
  v_value_after := v_new_quantity * p_unit_price * p_fx_rate;
  v_note := format(
    '加碼 %s TWD · %s',
    v_plan.amount_twd::text,
    case when p_source = 'cron' then '定期定額(cron)' else '定期定額' end
  );

  insert into public.recurring_plan_runs (
    plan_id, user_id, account_id, scheduled_date, executed_date, executed_at,
    source, amount_twd, shares_added, unit_price, fx_rate
  ) values (
    v_plan.id, v_plan.user_id, v_plan.account_id, p_expected_run_date,
    v_execution_date, p_executed_at, p_source, v_plan.amount_twd,
    v_shares_added, p_unit_price, p_fx_rate
  )
  on conflict (plan_id, scheduled_date) do nothing
  returning id into v_run_id;

  if v_run_id is null then
    return query select false, null::numeric, null::numeric, v_plan.next_run_date;
    return;
  end if;

  update public.accounts set
    quantity = v_new_quantity,
    cost_basis_twd = v_new_cost_twd,
    cost_basis_native = v_new_cost_native,
    last_unit_price = p_unit_price,
    last_fx_rate = p_fx_rate,
    last_priced_at = p_priced_at,
    updated_at = now()
  where id = v_account.id;

  insert into public.transactions (
    user_id, account_id, type, quantity_after, unit_price, fx_rate,
    value_after_base, note, created_at, cashflow_twd
  ) values (
    v_plan.user_id, v_account.id, 'adjust_quantity', v_new_quantity,
    p_unit_price, p_fx_rate, v_value_after, v_note, p_executed_at,
    -v_plan.amount_twd
  )
  returning id into v_transaction_id;

  insert into public.account_snapshots (
    user_id, account_id, snapshot_date, quantity, unit_price, fx_rate, value_base
  ) values (
    v_plan.user_id, v_account.id, v_execution_date, v_new_quantity,
    p_unit_price, p_fx_rate, v_value_after
  )
  on conflict (account_id, snapshot_date) do update set
    quantity = excluded.quantity,
    unit_price = excluded.unit_price,
    fx_rate = excluded.fx_rate,
    value_base = excluded.value_base;

  update public.recurring_plan_runs
  set transaction_id = v_transaction_id
  where id = v_run_id;

  v_next_month := (
    v_execution_date - (extract(day from v_execution_date)::integer - 1)
    + interval '1 month'
  )::date;
  v_next_run_date := make_date(
    extract(year from v_next_month)::integer,
    extract(month from v_next_month)::integer,
    v_plan.day_of_month
  );

  update public.recurring_plans set
    last_run_date = v_execution_date,
    next_run_date = v_next_run_date,
    updated_at = now()
  where id = v_plan.id;

  return query select true, v_shares_added, v_new_quantity, v_next_run_date;
end;
$$;

do $grants$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant select on public.recurring_plan_runs to authenticated;
    grant execute on function public.execute_recurring_plan_mutation(
      uuid, date, timestamptz, numeric, numeric, timestamptz, text
    ) to authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant all on public.recurring_plan_runs to service_role;
    grant execute on function public.execute_recurring_plan_mutation(
      uuid, date, timestamptz, numeric, numeric, timestamptz, text
    ) to service_role;
  end if;
end
$grants$;
