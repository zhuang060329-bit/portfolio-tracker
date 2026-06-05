"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Mode = "signIn" | "signUp" | "reset";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const supabase = createClient();

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setMessage(null);
  }

  async function signInGoogle() {
    setLoading(true);
    setError(null);
    setMessage(null);
    const { error: e } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (e) {
      setLoading(false);
      setError(`Google 登入失敗：${e.message}`);
    }
  }

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (mode === "signUp") {
      const { error: e1 } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      setLoading(false);
      if (e1) {
        setError(e1.message);
      } else {
        // 保留在 signUp mode 顯示成功訊息，使用者讀完自己按「返回登入」
        setMessage(
          `驗證信已寄到 ${email}\n` +
            `請打開信箱，點信中的「Confirm your mail」連結完成註冊。\n` +
            `信可能會在 1-2 分鐘內到，也可能跑去垃圾信件夾。`,
        );
        setPassword("");
      }
    } else if (mode === "reset") {
      const { error: e2 } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      setLoading(false);
      if (e2) {
        setError(e2.message);
      } else {
        setMessage(
          `若 ${email} 為已註冊帳號，重設密碼信已寄出。\n` +
            `打開信箱點連結後即可設定新密碼。`,
        );
      }
    } else {
      const { error: e3 } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (e3) {
        setLoading(false);
        setError(e3.message);
      } else {
        window.location.href = "/";
      }
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[var(--c-page)] p-6">
      <div className="w-full max-w-sm rounded-md border border-[var(--c-border)] bg-[var(--c-surface)] p-8 shadow-sm">
        <div className="flex flex-col gap-2">
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-[var(--c-text)]">
            Portfolio Tracker
          </h1>
          <p className="text-sm text-[var(--c-muted)]">
            {mode === "signUp"
              ? "建立帳號"
              : mode === "reset"
                ? "重設密碼"
                : "登入以管理你的資產"}
          </p>
        </div>

        {mode !== "reset" && (
          <>
            <button
              type="button"
              onClick={signInGoogle}
              disabled={loading}
              className="mt-6 w-full rounded-sm bg-[var(--c-accent)] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "處理中…" : "使用 Google 登入"}
            </button>
            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-[var(--c-border)]" />
              <span className="text-xs text-[var(--c-faint)]">或 Email</span>
              <div className="h-px flex-1 bg-[var(--c-border)]" />
            </div>
          </>
        )}

        <form
          onSubmit={submitEmail}
          className={`flex flex-col gap-3 ${mode === "reset" ? "mt-6" : ""}`}
        >
          <label className="flex flex-col gap-1 text-xs text-[var(--c-muted)]">
            Email
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="rounded border border-[var(--c-border)] px-3 py-2 text-sm text-[var(--c-text)]"
            />
          </label>
          {mode !== "reset" && (
            <label className="flex flex-col gap-1 text-xs text-[var(--c-muted)]">
              密碼
              <input
                type="password"
                required
                minLength={8}
                autoComplete={mode === "signUp" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "signUp" ? "至少 8 個字元" : ""}
                className="rounded border border-[var(--c-border)] px-3 py-2 text-sm text-[var(--c-text)]"
              />
            </label>
          )}
          {error && (
            <p className="rounded bg-red-50 dark:bg-red-950/40 px-3 py-2 text-xs text-red-700 dark:text-red-300">
              {error}
            </p>
          )}
          {message && (
            <div
              role="status"
              aria-live="polite"
              className="rounded-md border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-3 text-sm text-emerald-800 dark:text-emerald-300"
            >
              <div className="flex items-start gap-2">
                <span className="text-base leading-5">✓</span>
                <p className="whitespace-pre-line leading-snug">{message}</p>
              </div>
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-sm bg-[var(--c-btn-strong-bg)] px-6 py-2.5 text-sm font-semibold text-[var(--c-btn-strong-text)] shadow-sm hover:opacity-90 disabled:opacity-50"
          >
            {loading
              ? "處理中…"
              : mode === "signUp"
                ? "建立帳號"
                : mode === "reset"
                  ? "寄出重設信"
                  : "Email 登入"}
          </button>
        </form>

        <div className="mt-4 flex flex-col items-center gap-1 text-xs text-[var(--c-muted)]">
          {mode === "signIn" && (
            <>
              <button
                type="button"
                onClick={() => switchMode("signUp")}
                className="underline hover:text-[var(--c-text)]"
              >
                首次使用？建立帳號
              </button>
              <button
                type="button"
                onClick={() => switchMode("reset")}
                className="underline hover:text-[var(--c-text)]"
              >
                忘記密碼？
              </button>
            </>
          )}
          {mode === "signUp" && (
            <button
              type="button"
              onClick={() => switchMode("signIn")}
              className="underline hover:text-[var(--c-text)]"
            >
              已有帳號？登入
            </button>
          )}
          {mode === "reset" && (
            <button
              type="button"
              onClick={() => switchMode("signIn")}
              className="underline hover:text-[var(--c-text)]"
            >
              ← 返回登入
            </button>
          )}
        </div>

        <p className="mt-4 text-[10px] text-[var(--c-faint)]">
          首次註冊需點擊驗證信中的連結才能登入。
        </p>
      </div>
    </main>
  );
}
