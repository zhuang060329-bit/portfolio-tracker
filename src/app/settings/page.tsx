import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { MfaSetup } from "./MfaSetup";
import { isAdmin } from "@/lib/admin";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const admin = isAdmin(user?.email);

  return (
    <div className="min-h-screen bg-[var(--c-page)] text-[var(--c-text)]">
      <AppHeader active={null} userEmail={user?.email} />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="mb-4 text-sm">
          <Link href="/" className="text-[var(--c-muted)] hover:text-[var(--c-text)]">
            ← Back to portfolio
          </Link>
        </div>
        <header>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">
            Settings
          </h1>
          <p className="mt-2 text-sm text-[var(--c-muted)]">
            帳號 · 安全。登入：{user?.email}
          </p>
        </header>

        <section className="mt-6 rounded-md border border-[var(--c-border)] bg-[var(--c-surface)] p-5 shadow-sm">
          <h2 className="font-serif text-lg font-semibold tracking-tight">
            Multi-factor authentication
          </h2>
          <p className="mt-1 text-xs text-[var(--c-muted)]">
            啟用後，登入時除 Google 帳號外還需手機 Authenticator 產生的 6 位數驗證碼。
          </p>
          <div className="mt-4">
            <MfaSetup />
          </div>
        </section>

        {admin && (
          <section className="mt-6 rounded-md border border-[var(--c-border)] bg-[var(--c-surface)] p-5 shadow-sm">
            <h2 className="font-serif text-lg font-semibold tracking-tight">
              Admin
            </h2>
            <p className="mt-1 text-xs text-[var(--c-muted)]">
              只有管理員看得到。
            </p>
            <Link
              href="/admin/allowlist"
              className="mt-4 inline-flex items-center gap-2 rounded-sm border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-1.5 text-sm text-[var(--c-text)] hover:bg-[var(--c-page)]"
            >
              → 邀請名單管理
            </Link>
          </section>
        )}
      </main>
    </div>
  );
}
