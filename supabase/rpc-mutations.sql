-- 原子寫入 RPC：把「更新帳戶 + 寫流水 + upsert 快照」收進單一交易。
-- 動機：JS 端的 Supabase client 沒有交易，先 update 帳戶再 insert 流水的
-- 流程若中途失敗，會留下「帳已變、流水沒寫」的 partial state——金融資料
-- 最不能接受的狀態。plpgsql 函式本身就是一個交易，任一步失敗整體回滾。
--
-- 安全模型：security invoker + 既有 RLS。
--   - 使用者 client 呼叫：RLS 讓 select 只看得到自己的帳戶，
--     查無 user_id 即視為不存在或無權限，直接 raise。
--   - cron 的 service client 呼叫：service_role 繞過 RLS，行為與現行相同。
--
-- 已知限制：
--   - p_account_patch 用 coalesce 合併，無法把欄位「更新為 NULL」；
--     現有全部寫入流程都不需要，若未來需要再開專用參數。
--   - recurring_plans 的 next_run_date 推進仍在函式之外
--     （屬排程簿記，非帳務資料），雙重執行防護是獨立議題。
--
-- 套用方式：Supabase Dashboard → SQL Editor → 貼上全文 → Run。
-- 回滾：drop function public.apply_account_mutation(uuid, jsonb, jsonb, jsonb);

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
  -- RLS 之下，非本人帳戶等同不存在
  select user_id into v_user_id from accounts where id = p_account_id;
  if v_user_id is null then
    raise exception '帳戶不存在或無權限';
  end if;

  -- 部分更新：patch 裡沒出現的欄位保持原值
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

  -- 流水（refresh 類寫入沒有流水，允許 null）
  if p_transaction is not null then
    insert into transactions (
      user_id, account_id, type, quantity_after, unit_price,
      fx_rate, value_after_base, note, created_at, cashflow_twd
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
      (p_transaction->>'cashflow_twd')::numeric
    );
  end if;

  -- 快照 0~2 筆（occurredAt 當天 + 非今日時補今天）
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
