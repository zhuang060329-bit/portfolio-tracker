-- Email Allowlist：只允許名單上的 email 註冊（不論 Google OAuth 或 Email/Password）
-- 在 Supabase SQL Editor 跑。

-- 1) allowlist 表
create table if not exists allowed_emails (
  email text primary key,
  added_at timestamptz not null default now(),
  note text
);

-- 不開放一般使用者讀 allowlist，只有 admin 透過 SQL Editor 管理
alter table allowed_emails enable row level security;
-- 故意不建任何 policy → RLS 全擋（service-role 仍能繞過用於管理）

-- 2) 預先把你自己加進去（admin）
insert into allowed_emails (email, note)
values ('zhuang060329@gmail.com', 'admin')
on conflict (email) do nothing;

-- 3) Trigger：BEFORE INSERT on auth.users 檢查 email 是否在 allowlist
--    不在就 raise exception → 註冊被擋下
create or replace function public.check_email_allowed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.allowed_emails
    where lower(email) = lower(new.email)
  ) then
    raise exception 'Email % is not in the allowlist. Contact the admin to be added.', new.email
      using errcode = '42501';
  end if;
  return new;
end;
$$;

-- 移除既有同名 trigger（重複跑此 SQL 不會壞）
drop trigger if exists on_auth_user_check_allowlist on auth.users;
create trigger on_auth_user_check_allowlist
  before insert on auth.users
  for each row execute function public.check_email_allowed();

-- ===== 用法 =====
-- 將來要加家人 / 朋友的 email，在 SQL Editor 跑：
--   insert into allowed_emails (email, note) values ('friend@example.com', '王小明 - 家人');
--
-- 要移除：
--   delete from allowed_emails where email = 'friend@example.com';
--
-- 列出目前 allowlist：
--   select * from allowed_emails order by added_at desc;
