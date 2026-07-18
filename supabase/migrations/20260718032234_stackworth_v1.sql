-- StackWorth v1：決策日誌、可追溯快照與使用者風險偏好。
-- 本 migration 只擴充既有 schema；舊快照無法可靠推回的欄位刻意保留 null。

alter table public.profiles
  add column concentration_limit_pct numeric(5,2) not null default 25
  check (concentration_limit_pct > 0 and concentration_limit_pct <= 100);

alter table public.account_snapshots
  add column cost_basis_twd numeric(20,2),
  add column cost_basis_native numeric(20,8),
  add column realized_pnl_twd numeric(20,2),
  add column account_status account_status;

create table public.account_status_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  status account_status not null,
  effective_at timestamptz not null default now(),
  source text not null default 'account_update'
    check (source in ('account_create', 'account_update', 'migration_baseline')),
  created_at timestamptz not null default now()
);

create index account_status_history_lookup_idx
  on public.account_status_history (user_id, account_id, effective_at desc);

create table public.investment_decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete set null,
  transaction_id uuid references public.transactions(id) on delete set null,
  decision_date date not null,
  asset_name text not null check (char_length(asset_name) between 1 and 120),
  symbol text check (symbol is null or char_length(symbol) <= 40),
  decision_type text not null
    check (decision_type in ('buy', 'add', 'reduce', 'sell', 'hold', 'avoid')),
  thesis text not null check (char_length(thesis) between 1 and 4000),
  catalysts text not null default '' check (char_length(catalysts) <= 3000),
  risks text not null check (char_length(risks) between 1 and 3000),
  invalidation_conditions text not null
    check (char_length(invalidation_conditions) between 1 and 3000),
  expected_holding_months integer not null
    check (expected_holding_months between 1 and 600),
  target_return_min_pct numeric(8,3),
  target_return_max_pct numeric(8,3),
  max_drawdown_pct numeric(8,3)
    check (max_drawdown_pct is null or (max_drawdown_pct >= 0 and max_drawdown_pct <= 100)),
  confidence smallint not null check (confidence between 1 and 3),
  review_date date not null,
  tags text[] not null default '{}'::text[],
  status text not null default 'open'
    check (status in ('open', 'reviewed', 'archived')),
  context_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    target_return_min_pct is null
    or target_return_max_pct is null
    or target_return_min_pct <= target_return_max_pct
  ),
  check (review_date >= decision_date),
  check (cardinality(tags) <= 12)
);

create index investment_decisions_user_date_idx
  on public.investment_decisions (user_id, decision_date desc);
create index investment_decisions_due_idx
  on public.investment_decisions (user_id, review_date)
  where status = 'open';

create table public.decision_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  decision_id uuid not null unique
    references public.investment_decisions(id) on delete cascade,
  reviewed_at timestamptz not null default now(),
  hypothesis_outcome text not null check (char_length(hypothesis_outcome) between 1 and 3000),
  catalyst_outcome text not null default '' check (char_length(catalyst_outcome) <= 3000),
  risk_outcome text not null default '' check (char_length(risk_outcome) <= 3000),
  plan_followed boolean not null,
  asset_return_pct numeric(10,4),
  twd_return_pct numeric(10,4),
  fx_effect_pct numeric(10,4),
  max_favorable_excursion_pct numeric(10,4),
  max_adverse_excursion_pct numeric(10,4),
  decision_quality smallint not null check (decision_quality between 1 and 3),
  reflection text not null check (char_length(reflection) between 1 and 4000),
  next_improvement text not null check (char_length(next_improvement) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index decision_reviews_user_reviewed_idx
  on public.decision_reviews (user_id, reviewed_at desc);

alter table public.account_status_history enable row level security;
alter table public.investment_decisions enable row level security;
alter table public.decision_reviews enable row level security;

create policy account_status_history_select_own
  on public.account_status_history for select to authenticated
  using ((select auth.uid()) = user_id);
create policy account_status_history_insert_own
  on public.account_status_history for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy investment_decisions_select_own
  on public.investment_decisions for select to authenticated
  using ((select auth.uid()) = user_id);
create policy investment_decisions_insert_own
  on public.investment_decisions for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy investment_decisions_update_own
  on public.investment_decisions for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy investment_decisions_delete_own
  on public.investment_decisions for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy decision_reviews_select_own
  on public.decision_reviews for select to authenticated
  using ((select auth.uid()) = user_id);
create policy decision_reviews_insert_own
  on public.decision_reviews for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.investment_decisions d
      where d.id = decision_id and d.user_id = (select auth.uid())
    )
  );
create policy decision_reviews_update_own
  on public.decision_reviews for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.investment_decisions d
      where d.id = decision_id and d.user_id = (select auth.uid())
    )
  );
create policy decision_reviews_delete_own
  on public.decision_reviews for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert on table public.account_status_history to authenticated;
grant select, insert, update, delete on table public.investment_decisions to authenticated;
grant select, insert, update, delete on table public.decision_reviews to authenticated;

create or replace function public.record_account_status_history()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.account_status_history (
      user_id, account_id, status, effective_at, source
    ) values (
      new.user_id,
      new.id,
      new.status,
      now(),
      case when tg_op = 'INSERT' then 'account_create' else 'account_update' end
    );
  end if;
  return new;
end;
$$;

create trigger account_status_history_after_change
after insert or update of status on public.accounts
for each row execute function public.record_account_status_history();

-- 既有帳戶只有 migration 當下狀態可信，不能把目前狀態偽裝成完整歷史。
insert into public.account_status_history (
  user_id, account_id, status, effective_at, source
)
select user_id, id, status, now(), 'migration_baseline'
from public.accounts;

create or replace function public.fill_account_snapshot_history_fields()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_account public.accounts%rowtype;
begin
  if new.cost_basis_twd is null
    or new.cost_basis_native is null
    or new.realized_pnl_twd is null
    or new.account_status is null then
    select * into v_account
    from public.accounts
    where id = new.account_id;

    if not found then
      raise exception '快照所屬帳戶不存在或無權限';
    end if;

    new.cost_basis_twd := coalesce(new.cost_basis_twd, v_account.cost_basis_twd);
    new.cost_basis_native := coalesce(new.cost_basis_native, v_account.cost_basis_native);
    new.realized_pnl_twd := coalesce(new.realized_pnl_twd, v_account.realized_pnl_twd);
    new.account_status := coalesce(new.account_status, v_account.status);
  end if;
  return new;
end;
$$;

create trigger account_snapshots_fill_history_fields
before insert or update on public.account_snapshots
for each row execute function public.fill_account_snapshot_history_fields();

create or replace function public.protect_decision_context_snapshot()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.context_snapshot is distinct from old.context_snapshot then
    raise exception '決策建立時的情境快照不可修改';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger investment_decisions_protect_snapshot
before update on public.investment_decisions
for each row execute function public.protect_decision_context_snapshot();

create or replace function public.touch_decision_review_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger decision_reviews_touch_updated_at
before update on public.decision_reviews
for each row execute function public.touch_decision_review_updated_at();

create or replace function public.save_decision_review(
  p_decision_id uuid,
  p_review jsonb
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid;
  v_review_id uuid;
begin
  select user_id into v_user_id
  from public.investment_decisions
  where id = p_decision_id
  for update;

  if v_user_id is null then
    raise exception '決策不存在或無權限';
  end if;

  insert into public.decision_reviews (
    user_id, decision_id, reviewed_at, hypothesis_outcome,
    catalyst_outcome, risk_outcome, plan_followed, asset_return_pct,
    twd_return_pct, fx_effect_pct, max_favorable_excursion_pct,
    max_adverse_excursion_pct, decision_quality, reflection,
    next_improvement
  ) values (
    v_user_id,
    p_decision_id,
    coalesce((p_review->>'reviewed_at')::timestamptz, now()),
    p_review->>'hypothesis_outcome',
    coalesce(p_review->>'catalyst_outcome', ''),
    coalesce(p_review->>'risk_outcome', ''),
    (p_review->>'plan_followed')::boolean,
    (p_review->>'asset_return_pct')::numeric,
    (p_review->>'twd_return_pct')::numeric,
    (p_review->>'fx_effect_pct')::numeric,
    (p_review->>'max_favorable_excursion_pct')::numeric,
    (p_review->>'max_adverse_excursion_pct')::numeric,
    (p_review->>'decision_quality')::smallint,
    p_review->>'reflection',
    p_review->>'next_improvement'
  )
  on conflict (decision_id) do update set
    reviewed_at = excluded.reviewed_at,
    hypothesis_outcome = excluded.hypothesis_outcome,
    catalyst_outcome = excluded.catalyst_outcome,
    risk_outcome = excluded.risk_outcome,
    plan_followed = excluded.plan_followed,
    asset_return_pct = excluded.asset_return_pct,
    twd_return_pct = excluded.twd_return_pct,
    fx_effect_pct = excluded.fx_effect_pct,
    max_favorable_excursion_pct = excluded.max_favorable_excursion_pct,
    max_adverse_excursion_pct = excluded.max_adverse_excursion_pct,
    decision_quality = excluded.decision_quality,
    reflection = excluded.reflection,
    next_improvement = excluded.next_improvement,
    updated_at = now()
  returning id into v_review_id;

  update public.investment_decisions
  set status = 'reviewed', updated_at = now()
  where id = p_decision_id;

  return v_review_id;
end;
$$;

revoke execute on function public.save_decision_review(uuid, jsonb)
  from public, anon;
grant execute on function public.save_decision_review(uuid, jsonb)
  to authenticated, service_role;

-- 保留既有 RPC 介面；新快照在同一交易內保存更新後帳戶的成本與狀態。
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
  v_account public.accounts%rowtype;
  snap jsonb;
begin
  select user_id into v_user_id
  from public.accounts
  where id = p_account_id;

  if v_user_id is null then
    raise exception '帳戶不存在或無權限';
  end if;

  update public.accounts set
    quantity = coalesce((p_account_patch->>'quantity')::numeric, quantity),
    cost_basis_twd = coalesce((p_account_patch->>'cost_basis_twd')::numeric, cost_basis_twd),
    cost_basis_native = coalesce((p_account_patch->>'cost_basis_native')::numeric, cost_basis_native),
    realized_pnl_twd = coalesce((p_account_patch->>'realized_pnl_twd')::numeric, realized_pnl_twd),
    last_unit_price = coalesce((p_account_patch->>'last_unit_price')::numeric, last_unit_price),
    last_fx_rate = coalesce((p_account_patch->>'last_fx_rate')::numeric, last_fx_rate),
    last_priced_at = coalesce((p_account_patch->>'last_priced_at')::timestamptz, last_priced_at),
    manual_value_base = coalesce((p_account_patch->>'manual_value_base')::numeric, manual_value_base),
    updated_at = now()
  where id = p_account_id
  returning * into v_account;

  if p_transaction is not null then
    insert into public.transactions (
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
    insert into public.account_snapshots (
      user_id, account_id, snapshot_date, quantity, unit_price, fx_rate,
      value_base, cost_basis_twd, cost_basis_native, realized_pnl_twd,
      account_status
    ) values (
      v_user_id,
      p_account_id,
      (snap->>'snapshot_date')::date,
      (snap->>'quantity')::numeric,
      (snap->>'unit_price')::numeric,
      coalesce((snap->>'fx_rate')::numeric, 1),
      (snap->>'value_base')::numeric,
      coalesce((snap->>'cost_basis_twd')::numeric, v_account.cost_basis_twd),
      coalesce((snap->>'cost_basis_native')::numeric, v_account.cost_basis_native),
      coalesce((snap->>'realized_pnl_twd')::numeric, v_account.realized_pnl_twd),
      coalesce((snap->>'account_status')::account_status, v_account.status)
    )
    on conflict (account_id, snapshot_date) do update set
      quantity = excluded.quantity,
      unit_price = excluded.unit_price,
      fx_rate = excluded.fx_rate,
      value_base = excluded.value_base,
      cost_basis_twd = excluded.cost_basis_twd,
      cost_basis_native = excluded.cost_basis_native,
      realized_pnl_twd = excluded.realized_pnl_twd,
      account_status = excluded.account_status;
  end loop;
end;
$$;

revoke execute on function public.apply_account_mutation(uuid, jsonb, jsonb, jsonb)
  from public, anon;
grant execute on function public.apply_account_mutation(uuid, jsonb, jsonb, jsonb)
  to authenticated, service_role;

notify pgrst, 'reload schema';
