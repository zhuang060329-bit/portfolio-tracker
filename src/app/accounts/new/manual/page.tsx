import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { getUnreadCount } from "@/lib/notifications";
import { PageHead } from "@/components/survey";
import { ManualForm } from "./ManualForm";

export default async function NewManualPage() {
  const supabase = await createClient();
  const [
    {
      data: { user },
    },
    unreadCount,
  ] = await Promise.all([supabase.auth.getUser(), getUnreadCount()]);

  return (
    <div className="min-h-dvh bg-[var(--c-page)] text-[var(--c-text)]">
      <AppHeader active="accounts" userEmail={user?.email} unreadCount={unreadCount} />
      <main id="main" tabIndex={-1} className="mx-auto max-w-2xl px-4 pb-24 pt-8 sm:px-6 lg:px-8">
        <Link
          href="/accounts/new"
          className="text-[length:var(--fs-sm)] text-[var(--c-muted)] hover:text-[var(--c-accent)]"
        >
          ← 新增帳戶
        </Link>
        <PageHead
          className="mt-4"
          label="新增帳戶 · 手動"
          title="新增手動帳戶"
          sub="手動帳戶不自動抓價，餘額之後可在帳戶詳情頁手動修改。"
        />

        <ManualForm />
      </main>
    </div>
  );
}
