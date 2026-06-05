"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    // Supabase 在跳轉回來後會於 onAuthStateChange 觸發 PASSWORD_RECOVERY event；
    // 我們也檢查目前是否有 session（recovery type）才允許設定新密碼。
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });
    // 初次掛載也檢查一次（重整或直接連 URL 時）
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => {
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("密碼至少 8 個字元");
      return;
    }
    if (password !== confirm) {
      setError("兩次輸入不一致");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: e1 } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (e1) {
      setError(e1.message);
      return;
    }
    setSuccess(true);
    // 2 秒後導向首頁（已自動登入）
    setTimeout(() => router.replace("/"), 2000);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[var(--c-page)] p-6">
      <div className="w-full max-w-sm rounded-md border border-[var(--c-border)] bg-[var(--c-surface)] p-8 shadow-sm">
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-[var(--c-text)]">
          重設密碼
        </h1>
        {!ready ? (
          <p className="mt-4 text-sm text-[var(--c-muted)]">
            驗證連結中…
            <br />
            若一直停在這頁，可能連結已過期或無效，請回
            <a
              href="/login"
              className="ml-1 underline hover:text-[var(--c-text)]"
            >
              登入頁
            </a>
            重新點「忘記密碼？」。
          </p>
        ) : success ? (
          <p className="mt-4 rounded bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-300">
            密碼已更新，即將導向首頁…
          </p>
        ) : (
          <form onSubmit={submit} className="mt-6 flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-xs text-[var(--c-muted)]">
              新密碼
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="至少 8 個字元"
                className="rounded border border-[var(--c-border)] px-3 py-2 text-sm text-[var(--c-text)]"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-[var(--c-muted)]">
              再次確認
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="rounded border border-[var(--c-border)] px-3 py-2 text-sm text-[var(--c-text)]"
              />
            </label>
            {error && (
              <p className="rounded bg-red-50 dark:bg-red-950/40 px-2 py-1 text-xs text-red-700 dark:text-red-300">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-sm bg-[var(--c-accent)] px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "更新中…" : "更新密碼"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
