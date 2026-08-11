-- StackWorth：免費報價 API 的全域每日預算。
--
-- 動機：現有的節流只有 refresh-actions.ts 的 per-user 10 分鐘冷卻，
-- 那是「同一個人不要連打」，不是「全站不要打爆」。開放註冊之後所有人共用同一組
-- API key，冷卻擋不住 N 個使用者各自在冷卻窗外正常操作把當日額度用光；
-- 額度一旦用光，cron 當天的自動更新也會跟著失敗，影響到的是全部人的資料新鮮度。
--
-- 做法：一張以 (provider, usage_date) 為主鍵的計數表，加一支原子的扣減函式。
--
-- 為什麼是「先檢查再累加」寫在同一個 statement：
--   分成 select 再 update 會有 race——兩個併發請求都讀到 799、都認為還有額度、
--   都打出去。這裡用 insert ... on conflict do update ... where 把判斷放進
--   同一個 statement，額度不足時 where 不成立、不回傳任何列，呼叫端據此拒絕。
--
-- 日界線用台北時間，與 todayTaipei() 及 cron（06:00 UTC = 台北 14:00）一致。
-- 注意這是「我們自己的預算」，不是各家 API 公布的重置窗口；上限本來就設得比
-- 對方的額度低，所以兩者不需要對齊。
--
-- RLS：啟用但不建立任何一般使用者的 policy。這是營運資料，不屬於任何 user，
-- 只有 service_role（server action 與 cron）碰得到。
--
-- 套用方式：Supabase Dashboard → SQL Editor → 貼上全文 → Run。

create table if not exists public.api_usage (
  provider text not null,
  usage_date date not null,
  calls integer not null default 0 check (calls >= 0),
  updated_at timestamptz not null default now(),
  primary key (provider, usage_date)
);

comment on table public.api_usage is
  '免費報價 API 的每日呼叫計數。全域共用，不屬於任何使用者。';

alter table public.api_usage enable row level security;

-- 刻意不建立 policy：RLS 開啟且無 policy = 一般使用者讀不到也寫不進，
-- service_role 繞過 RLS 仍可存取。

create or replace function public.consume_api_quota(
  p_provider text,
  p_limit integer,
  p_cost integer default 1
) returns table (used integer, remaining integer)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Taipei')::date;
  v_used integer;
begin
  if p_provider is null or length(btrim(p_provider)) = 0 then
    raise exception '缺少 provider';
  end if;
  if p_limit is null or p_limit < 0 then
    raise exception '額度上限需為非負整數';
  end if;
  if p_cost is null or p_cost <= 0 then
    raise exception '扣減量需為正整數';
  end if;

  insert into public.api_usage as u (provider, usage_date, calls, updated_at)
  values (p_provider, v_today, p_cost, now())
  on conflict (provider, usage_date) do update
    set calls = u.calls + p_cost,
        updated_at = now()
    where u.calls + p_cost <= p_limit
  returning u.calls into v_used;

  -- 第一次 insert 也可能超標（p_cost > p_limit），這裡一併擋掉。
  if v_used is null or v_used > p_limit then
    if v_used is not null then
      -- insert 分支不受 on conflict 的 where 保護，超標的話要回滾這次累加
      update public.api_usage
         set calls = greatest(0, calls - p_cost)
       where provider = p_provider and usage_date = v_today;
    end if;
    return;
  end if;

  used := v_used;
  remaining := greatest(0, p_limit - v_used);
  return next;
end;
$$;

comment on function public.consume_api_quota(text, integer, integer) is
  '原子地扣減當日額度。額度不足時不回傳任何列，且不累加計數。';

revoke all on function public.consume_api_quota(text, integer, integer) from public;
revoke all on function public.consume_api_quota(text, integer, integer) from anon;
revoke all on function public.consume_api_quota(text, integer, integer) from authenticated;
grant execute on function public.consume_api_quota(text, integer, integer) to service_role;

-- 讓 PostgREST 立刻看到新表與新函式
notify pgrst, 'reload schema';
