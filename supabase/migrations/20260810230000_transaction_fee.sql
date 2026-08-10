-- StackWorth：交易手續費。
--
-- 動機：加碼買入時所有投入金額都被當成買到股票的錢，股數 = 投入 / 每股 TWD。
-- 券商手續費（複委託常見低消 15–35 USD）沒有欄位可記，等於被算成買到了更多股，
-- 持股數與每股成本雙雙失真，且誤差隨每期定期定額累積。
--
-- 語意（費用內含）：使用者填的金額是「實際從戶頭出去的錢」。
--   股數增量   = (金額 − 手續費) / 每股 TWD      ← 這裡才是修正點
--   成本 TWD   = 舊成本 + 金額                    ← 含費，符合證券會計
--   成本原幣   = 舊成本 + 金額 / 匯率
--   cashflow   = −金額                            ← 不變，XIRR 不受影響
--
-- 賣出方向的 proceeds 本來就定義為「券商實際匯入的淨額」，語意不動；
-- 手續費只在使用者留空收入、由成交價自動估算時扣除，其餘情況僅作記錄。
--
-- 欄位可空性：
--   transactions.fee_twd        nullable。舊交易一律留 null 表示「未記錄」，
--                               回填 0 會謊稱那些交易沒有手續費。
--   recurring_plans.fee_twd     not null default 0。這是計劃的設定值不是歷史，
--                               0 就是「這個計劃沒有手續費」，是真話。
--   recurring_plan_runs.fee_twd nullable，理由同 transactions。
--
-- 新增帶預設值的參數會產生 overload，8 參數的舊呼叫會變成 ambiguous，
-- 所以 execute_recurring_plan_mutation 先 drop 舊簽名再重建，並重新授權。
--
-- 套用方式：Supabase Dashboard → SQL Editor → 貼上全文 → Run。

alter table public.transactions
  add column if not exists fee_twd numeric(20,2)
  check (fee_twd is null or fee_twd >= 0);

alter table public.recurring_plans
  add column if not exists fee_twd numeric(20,2) not null default 0
  check (fee_twd >= 0);

alter table public.recurring_plan_runs
  add column if not exists fee_twd numeric(20,2)
  check (fee_twd is null or fee_twd >= 0);

-- 保留既有介面，只是流水多寫一個 fee_twd。其餘與 v1 版本逐字相同。
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
      fx_rate, value_after_base, note, created_at, cashflow_twd, realized_pnl,
      fee_twd
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
      (p_transaction->>'realized_pnl')::numeric,
      (p_transaction->>'fee_twd')::numeric
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

drop function if exists public.execute_recurring_plan_mutation(
  uuid, date, timestamptz, numeric, numeric, timestamptz, text, numeric
);

create function public.execute_recurring_plan_mutation(
  p_plan_id uuid,
  p_expected_run_date date,
  p_executed_at timestamptz,
  p_unit_price numeric,
  p_fx_rate numeric,
  p_priced_at timestamptz,
  p_source text default 'cron',
  p_amount_override numeric default null,
  p_fee_override numeric default null
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
  v_fee numeric;
  v_invested numeric;
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
  if p_source = 'cron' and p_fee_override is not null then
    raise exception '自動執行不接受覆寫手續費';
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

  v_fee := round(coalesce(p_fee_override, v_plan.fee_twd, 0), 2);
  if v_fee < 0 then
    raise exception '手續費不得為負數';
  end if;
  -- 費用內含：手續費吃掉整筆金額就沒有錢買股票了，擋在這裡比讓股數變 0 好懂。
  if v_fee >= v_amount then
    raise exception '手續費不得大於或等於本期金額';
  end if;

  v_invested := v_amount - v_fee;
  v_shares_added := v_invested / (p_unit_price * p_fx_rate);
  if v_shares_added <= 0 then
    raise exception '換算股數無效';
  end if;

  v_new_quantity := v_account.quantity + v_shares_added;
  v_new_cost_twd := v_account.cost_basis_twd + v_amount;
  v_new_cost_native := v_account.cost_basis_native + (v_amount / p_fx_rate);
  v_value_after := v_new_quantity * p_unit_price * p_fx_rate;
  v_note := format(
    '加碼 %s TWD%s · %s',
    v_amount::text,
    case when v_fee > 0 then format('（含手續費 %s）', v_fee::text) else '' end,
    case
      when p_source = 'cron' then '定期定額(cron)'
      when p_amount_override is not null or p_fee_override is not null
        then '定期定額(本期調整)'
      else '定期定額'
    end
  );

  insert into public.recurring_plan_runs (
    plan_id, user_id, account_id, scheduled_date, executed_date, executed_at,
    source, amount_twd, shares_added, unit_price, fx_rate, fee_twd
  ) values (
    v_plan.id, v_plan.user_id, v_plan.account_id, p_expected_run_date,
    v_execution_date, p_executed_at, p_source, v_amount,
    v_shares_added, p_unit_price, p_fx_rate, v_fee
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
    value_after_base, note, created_at, cashflow_twd, fee_twd
  ) values (
    v_plan.user_id, v_account.id, 'adjust_quantity', v_new_quantity,
    p_unit_price, p_fx_rate, v_value_after, v_note, p_executed_at,
    -v_amount, v_fee
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
      uuid, date, timestamptz, numeric, numeric, timestamptz, text, numeric, numeric
    ) to authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.execute_recurring_plan_mutation(
      uuid, date, timestamptz, numeric, numeric, timestamptz, text, numeric, numeric
    ) to service_role;
  end if;
end
$grants$;

notify pgrst, 'reload schema';
