import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { AppHeader } from "@/components/AppHeader";
import { isAdmin } from "@/lib/admin";
import { UsersManager, type UserRow } from "./AllowlistManager";

export default async function AdminUsers() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdmin(user.email)) {
    notFound();
  }

  // 用 service-role 列出所有 auth.users（一般 client 無權讀）
  const svc = createServiceClient();
  const { data, error } = await svc.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });

  const rows: UserRow[] = (data?.users ?? []).map((u) => ({
    id: u.id,
    email: u.email ?? "（無 email）",
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at ?? null,
    confirmed: !!u.email_confirmed_at,
  }));

  return (
    <div className="min-h-screen bg-[var(--c-page)] text-[var(--c-text)]">
      <AppHeader active={null} userEmail={user.email} />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="mb-4 text-sm">
          <Link
            href="/settings"
            className="text-[var(--c-muted)] hover:text-[var(--c-text)]"
          >
            ← Back to settings
          </Link>
        </div>
        <header>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">
            使用者管理
          </h1>
          <p className="mt-2 text-sm text-[var(--c-muted)]">
            已開放註冊，任何 email 都能建立帳號（須驗證信箱）。
            從這裡看誰註冊了，必要時可以踢出特定帳號。
          </p>
        </header>

        {error && (
          <p className="mt-4 rounded-[var(--r-control)] border border-[color-mix(in_srgb,var(--c-down)_30%,transparent)] bg-[color-mix(in_srgb,var(--c-down)_10%,var(--c-surface))] px-3 py-2 text-sm text-[var(--c-down)]">
            讀取使用者列表失敗：{error.message}
          </p>
        )}

        <div className="mt-6">
          <UsersManager rows={rows} currentUserId={user.id} />
        </div>
      </main>
    </div>
  );
}
