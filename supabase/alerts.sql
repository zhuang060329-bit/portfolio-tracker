-- ============================================================================
-- 警示與通知系統（站內 + 預留 email hook）
-- 執行順序：在 batch2-schema.sql 之後執行。
-- ============================================================================

-- 警示規則：使用者設定的觸發條件
create table if not exists alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- 警示類型：
  --   price_above        當帳戶單價（原幣）漲到 threshold 以上觸發
  --   price_below        當帳戶單價（原幣）跌到 threshold 以下觸發
  --   allocation_drift   當任何資產類別的實際 % 偏離目標 > threshold % 觸發
  type text not null check (type in ('price_above','price_below','allocation_drift')),
  -- 帳戶警示需指定 account_id；allocation_drift 為 null
  account_id uuid references accounts(id) on delete cascade,
  threshold numeric not null,
  note text,
  active boolean not null default true,
  last_triggered_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_alerts_user_active on alerts(user_id, active);
create index if not exists idx_alerts_account on alerts(account_id);

alter table alerts enable row level security;

drop policy if exists "user owns alerts" on alerts;
create policy "user owns alerts" on alerts
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 通知紀錄：警示觸發或系統訊息產生的條目
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  alert_id uuid references alerts(id) on delete set null,
  -- type 與 alerts.type 相同，或系統訊息 (system)
  type text not null,
  title text not null,
  body text,
  -- email 發送狀態（給未來 email hook 用）
  email_sent_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_notif_user_unread on notifications(user_id, read_at);
create index if not exists idx_notif_user_created on notifications(user_id, created_at desc);

alter table notifications enable row level security;

drop policy if exists "user owns notifications" on notifications;
create policy "user owns notifications" on notifications
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
