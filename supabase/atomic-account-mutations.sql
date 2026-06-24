-- 帳戶、交易與快照必須在同一個 PostgreSQL transaction 完成。
-- 請在既有 schema 與後續 migration 都執行後，再於 Supabase SQL Editor 執行本檔。

create or replace function public.create_account_with_initial_records(
  p_account jsonb,
  p_transaction jsonb,
  p_snapshot jsonb
) returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_account_id uuid;
begin
  if v_user_id is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  insert into public.accounts (
    user_id, name, asset_class, price_market, symbol, quantity,
    native_currency, last_unit_price, last_fx_rate, manual_value_base,
    last_priced_at, cost_basis_twd, cost_basis_native
  ) values (
    v_user_id,
    p_account->>'name',
    (p_account->>'asset_class')::public.asset_class,
    (p_account->>'price_market')::public.price_market,
    nullif(p_account->>'symbol', ''),
    (p_account->>'quantity')::numeric,
    p_account->>'native_currency',
    (p_account->>'last_unit_price')::numeric,
    (p_account->>'last_fx_rate')::numeric,
    (p_account->>'manual_value_base')::numeric,
    (p_account->>'last_priced_at')::timestamptz,
    (p_account->>'cost_basis_twd')::numeric,
    (p_account->>'cost_basis_native')::numeric
  ) returning id into v_account_id;

  insert into public.transactions (
    user_id, account_id, type, quantity_after, unit_price, fx_rate,
    value_after_base, cashflow_twd, realized_pnl, note, created_at
  ) values (
    v_user_id, v_account_id,
    (p_transaction->>'type')::public.txn_type,
    (p_transaction->>'quantity_after')::numeric,
    (p_transaction->>'unit_price')::numeric,
    (p_transaction->>'fx_rate')::numeric,
    (p_transaction->>'value_after_base')::numeric,
    (p_transaction->>'cashflow_twd')::numeric,
    (p_transaction->>'realized_pnl')::numeric,
    p_transaction->>'note',
    coalesce((p_transaction->>'created_at')::timestamptz, now())
  );

  insert into public.account_snapshots (
    user_id, account_id, snapshot_date, quantity, unit_price, fx_rate, value_base
  ) values (
    v_user_id, v_account_id,
    (p_snapshot->>'snapshot_date')::date,
    (p_snapshot->>'quantity')::numeric,
    (p_snapshot->>'unit_price')::numeric,
    (p_snapshot->>'fx_rate')::numeric,
    (p_snapshot->>'value_base')::numeric
  );

  return v_account_id;
end;
$$;

create or replace function public.apply_account_mutation(
  p_account_id uuid,
  p_account jsonb,
  p_transaction jsonb,
  p_snapshots jsonb default '[]'::jsonb
) returns void
language plpgsql
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  if jsonb_typeof(p_snapshots) <> 'array' then
    raise exception 'p_snapshots must be an array' using errcode = '22023';
  end if;

  update public.accounts
  set
    quantity = case when p_account ? 'quantity' then (p_account->>'quantity')::numeric else quantity end,
    last_unit_price = case when p_account ? 'last_unit_price' then (p_account->>'last_unit_price')::numeric else last_unit_price end,
    last_fx_rate = case when p_account ? 'last_fx_rate' then (p_account->>'last_fx_rate')::numeric else last_fx_rate end,
    last_priced_at = case when p_account ? 'last_priced_at' then (p_account->>'last_priced_at')::timestamptz else last_priced_at end,
    manual_value_base = case when p_account ? 'manual_value_base' then (p_account->>'manual_value_base')::numeric else manual_value_base end,
    cost_basis_twd = case when p_account ? 'cost_basis_twd' then (p_account->>'cost_basis_twd')::numeric else cost_basis_twd end,
    cost_basis_native = case when p_account ? 'cost_basis_native' then (p_account->>'cost_basis_native')::numeric else cost_basis_native end,
    realized_pnl_twd = case when p_account ? 'realized_pnl_twd' then (p_account->>'realized_pnl_twd')::numeric else realized_pnl_twd end,
    updated_at = now()
  where id = p_account_id
  returning user_id into v_user_id;

  if not found then
    raise exception 'account not found' using errcode = 'P0002';
  end if;

  insert into public.transactions (
    user_id, account_id, type, quantity_after, unit_price, fx_rate,
    value_after_base, cashflow_twd, realized_pnl, note, created_at
  ) values (
    v_user_id, p_account_id,
    (p_transaction->>'type')::public.txn_type,
    (p_transaction->>'quantity_after')::numeric,
    (p_transaction->>'unit_price')::numeric,
    (p_transaction->>'fx_rate')::numeric,
    (p_transaction->>'value_after_base')::numeric,
    (p_transaction->>'cashflow_twd')::numeric,
    (p_transaction->>'realized_pnl')::numeric,
    p_transaction->>'note',
    coalesce((p_transaction->>'created_at')::timestamptz, now())
  );

  insert into public.account_snapshots (
    user_id, account_id, snapshot_date, quantity, unit_price, fx_rate, value_base
  )
  select
    v_user_id, p_account_id, snapshot_date, quantity, unit_price, fx_rate, value_base
  from jsonb_to_recordset(p_snapshots) as snapshot(
    snapshot_date date,
    quantity numeric,
    unit_price numeric,
    fx_rate numeric,
    value_base numeric
  )
  on conflict (account_id, snapshot_date) do update
  set
    quantity = excluded.quantity,
    unit_price = excluded.unit_price,
    fx_rate = excluded.fx_rate,
    value_base = excluded.value_base;
end;
$$;

revoke all on function public.create_account_with_initial_records(jsonb, jsonb, jsonb) from public;
revoke all on function public.apply_account_mutation(uuid, jsonb, jsonb, jsonb) from public;
grant execute on function public.create_account_with_initial_records(jsonb, jsonb, jsonb) to authenticated, service_role;
grant execute on function public.apply_account_mutation(uuid, jsonb, jsonb, jsonb) to authenticated, service_role;

notify pgrst, 'reload schema';
