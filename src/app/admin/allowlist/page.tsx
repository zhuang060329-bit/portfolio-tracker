import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { AppHeader } from "@/components/AppHeader";
import { isAdmin } from "@/lib/admin";
import { AllowlistManager, type Row } from "./AllowlistManager";

export default async function AdminAllowlist() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 非 admin 直接 404（不讓他知道有這頁）
  if (!user || !isAdmin(user.email)) {
    notFound();
  }

  // 用 service client 讀 allowed_emails（一般使用者 RLS 全擋）
  const svc = createServiceClient();
  const { data } = await svc
    .from("allowed_emails")
    .select("email, note, added_at")
    .order("added_at", { ascending: false });

  const rows = (data ?? []) as Row[];

  return (
    <div className="min-h-screen bg-[var(--c-page)] text-[var(--c-text)]">
      <AppHeader active={null} userEmail={user.email} />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
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
            邀請名單
          </h1>
          <p className="mt-2 text-sm text-[var(--c-muted)]">
            管理可以註冊的 email。家人 / 朋友的 email 加進來，他們才能在 /login 建立帳號。
          </p>
        </header>

        <div className="mt-6">
          <AllowlistManager rows={rows} />
        </div>
      </main>
    </div>
  );
}
