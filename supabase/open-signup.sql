-- 改成開放註冊：任何 email 都能用（仍需 Supabase email 驗證）
-- 取代原本 email-allowlist.sql 的擋人 trigger。
-- 在 Supabase SQL Editor 跑。

drop trigger if exists on_auth_user_check_allowlist on auth.users;
drop function if exists public.check_email_allowed();
drop table if exists allowed_emails;

notify pgrst, 'reload schema';

-- 之後管理「誰可以用」改成 admin 在 /admin/allowlist 頁面看 auth.users 列表，
-- 必要時點「踢出」（呼叫 supabase.auth.admin.deleteUser）刪掉特定使用者。
