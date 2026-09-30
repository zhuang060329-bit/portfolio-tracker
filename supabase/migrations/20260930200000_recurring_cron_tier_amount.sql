-- execute_recurring_plan_mutation：cron 可以對「級距計劃」帶本期金額。
--
-- 為什麼要改：20260810155500 定下「cron 一律禁止覆寫金額」，理由是自動執行
-- 必須是可預期的固定金額。20260930180000 加了 tier_config 之後，級距計劃的
-- 金額本來就該隨回撤與均線乖離變動，cron 卻只能買基準金額，使用者得在每個
-- 排程日之前自己按「立即執行」才套得到級距。
--
-- 改了什麼（簽名、回傳欄位、權限都不變）：
--   1. cron 帶 p_amount_override：計劃有 tier_config 才放行；
--      固定金額計劃（tier_config is null）照舊拒絕，訊息也照舊。
--      這個檢查要讀計劃，所以從函式開頭移到鎖定計劃之後。
--   2. cron 帶 p_fee_override：照舊一律拒絕。
--   3. 流水備註：cron 帶金額時寫「定期定額(cron·級距，基準 N)」，
--      N 是計劃的基準金額，事後才看得出這一期為什麼不是基準金額。
--      其餘三種備註（定期定額(cron)、定期定額(本期調整)、定期定額）不變。
--
-- 沒改的：
--   函式不自己算級距。倍數由應用層依 FinMind 含息序列算好再帶進來
--   （src/lib/recurring-tier-amount.ts），函式只負責把它原子地寫進帳。
--   級距計劃的 cron 沒帶金額時，照舊用 amount_twd 執行、備註是「定期定額(cron)」；
--   「算不出級距就不執行」由應用層把關，不放在這裡——放在這裡的話，
--   這支 SQL 先跑、新版程式還沒部署的那段時間，級距計劃會全部執行失敗。
--
-- 執行順序：
--   要在 20260930180000_recurring_tier_config.sql 之後跑（函式會讀 tier_config）。
--   與程式部署的先後不會弄壞資料：
--     SQL 先跑、程式後上：舊程式的 cron 不帶金額，行為與現在相同。
--     程式先上、SQL 後跑：級距計劃的 cron 會被舊函式以「自動執行不接受覆寫金額」
--                         拒絕，該期不執行、計劃維持到期，隔天的 cron 會重試。
--
-- 可以整個貼進 SQL Editor 一次跑完，重跑也安全（create or replace）。

create or replace function public.execute_recurring_plan_mutation(
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
  -- cron 的金額只能來自級距：固定金額計劃沒有任何理由在無人值守時換金額。
  if p_source = 'cron' and p_amount_override is not null
     and v_plan.tier_config is null then
    raise exception '自動執行不接受覆寫金額';
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
      when p_source = 'cron' and p_amount_override is not null
        then format('定期定額(cron·級距，基準 %s)', v_plan.amount_twd::text)
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

-- create or replace 會保留既有權限；這一段只是讓這支檔單獨看也完整，重跑無害。
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
