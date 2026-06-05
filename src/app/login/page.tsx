"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);

  async function signInWithGoogle() {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setLoading(false);
      alert(`登入失敗：${error.message}`);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[var(--c-page)] p-6">
      <div className="w-full max-w-sm rounded-md border border-[var(--c-border)] bg-[var(--c-surface)] p-8 shadow-sm">
        <div className="flex flex-col gap-2">
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-[var(--c-text)]">
            Portfolio Tracker
          </h1>
          <p className="text-sm text-[var(--c-muted)]">登入以管理你的資產與定期定額計劃</p>
        </div>
        <button
          onClick={signInWithGoogle}
          disabled={loading}
          className="mt-6 w-full rounded-sm bg-[var(--c-accent)] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "前往 Google…" : "使用 Google 登入"}
        </button>
        <p className="mt-4 text-xs text-[var(--c-muted)]">
          首次登入會自動建立帳號，並於 Supabase 建立你專屬的 profile。
        </p>
      </div>
    </main>
  );
}
