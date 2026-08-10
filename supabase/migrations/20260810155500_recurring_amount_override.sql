-- StackWorth：定期定額單次執行覆寫金額。
--
-- 動機：實際操作不是固定金額扣款，而是看漲跌決定本期加碼或減碼。
-- 原本金額只讀 recurring_plans.amount_twd，應用層沒有任何覆寫入口。
--
-- 做法：execute_recurring_plan_mutation 新增 p_amount_override。
--   null（cron 走這條）→ 沿用計劃金額，行為與改動前完全相同。
--   有值（使用者按「立即執行」）→ 本期改用此金額，計劃的預設金額不變。
--
-- cron 一律禁止覆寫：自動執行必須是可預期的固定金額，臨時調整只能由人做。
--
-- 逐次真實金額已經記在 recurring_plan_runs.amount_twd，因此歷史會正確反映
-- 當期實際投入，不需要新增欄位。
--
-- 新增帶預設值的參數會產生 overload，7 參數的舊呼叫會變成 ambiguous，
-- 所以先 drop 舊簽名再重建，並重新授權。
--
-- 套用方式：Supabase Dashboard → SQL Editor → 貼上全文 → Run。

drop function if exists public.execute_recurring_plan_mutation(
  uuid, date, timestamptz, numeric, numeric, timestamptz, text
);

create function public.execute_recurring_plan_mutation(
  p_plan_id uuid,
  p_expected_run_date date,
  p_executed_at timestamptz,
  p_unit_price numeric,
  p_fx_rate numeric,
  p_priced_at timestamptz,
  p_source text default 'cron',
  p_amount_override numeric default null
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
  v_amount numeric;
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
  if p_source = 'cron' and p_amount_override is not null then
    raise exception '自動執行不接受覆寫金額';
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

  -- ledger 與 recurring_plans 都是 numeric(20,2)，先四捨五入再驗證，
  -- 讓 ledger 金額、cashflow 與成本增量三者用的是同一個數。
  v_amount := round(coalesce(p_amount_override, v_plan.amount_twd), 2);
  if v_amount <= 0 then
    raise exception '本期金額需為正數';
  end if;
  if v_amount > 100000000 then
    raise exception '本期金額不得超過 1 億';
  end if;

  v_shares_added := v_amount / (p_unit_price * p_fx_rate);
  if v_shares_added <= 0 then
    raise exception '換算股數無效';
  end if;

  v_new_quantity := v_account.quantity + v_shares_added;
  v_new_cost_twd := v_account.cost_basis_twd + v_amount;
  v_new_cost_native := v_account.cost_basis_native + (v_amount / p_fx_rate);
  v_value_after := v_new_quantity * p_unit_price * p_fx_rate;
  v_note := format(
    '加碼 %s TWD · %s',
    v_amount::text,
    case
      when p_source = 'cron' then '定期定額(cron)'
      when p_amount_override is not null then '定期定額(本期調整)'
      else '定期定額'
    end
  );

  insert into public.recurring_plan_runs (
    plan_id, user_id, account_id, scheduled_date, executed_date, executed_at,
    source, amount_twd, shares_added, unit_price, fx_rate
  ) values (
    v_plan.id, v_plan.user_id, v_plan.account_id, p_expected_run_date,
    v_execution_date, p_executed_at, p_source, v_amount,
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
    -v_amount
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
    grant execute on function public.execute_recurring_plan_mutation(
      uuid, date, timestamptz, numeric, numeric, timestamptz, text, numeric
    ) to authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.execute_recurring_plan_mutation(
      uuid, date, timestamptz, numeric, numeric, timestamptz, text, numeric
    ) to service_role;
  end if;
end
$grants$;

notify pgrst, 'reload schema';
