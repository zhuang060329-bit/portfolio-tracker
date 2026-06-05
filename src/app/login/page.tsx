"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const supabase = createClient();

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

    if (isSignUp) {
      const { error: e1 } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      setLoading(false);
      if (e1) {
        setError(e1.message);
      } else {
        setMessage(
          "已寄出驗證信到 " + email + "，點信中的連結確認後就能登入。",
        );
        setIsSignUp(false);
      }
    } else {
      const { error: e2 } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (e2) {
        setLoading(false);
        setError(e2.message);
      } else {
        // 登入成功，proxy 會處理導向（含 MFA 升級）
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
            {isSignUp ? "建立帳號" : "登入以管理你的資產"}
          </p>
        </div>

        {/* Google 登入（中國境內可能無法使用）*/}
        <button
          type="button"
          onClick={signInGoogle}
          disabled={loading}
          className="mt-6 w-full rounded-sm bg-[var(--c-accent)] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "處理中…" : "使用 Google 登入"}
        </button>

        {/* 分隔線 */}
        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-[var(--c-border)]" />
          <span className="text-xs text-[var(--c-faint)]">或 Email</span>
          <div className="h-px flex-1 bg-[var(--c-border)]" />
        </div>

        {/* Email + Password 表單 */}
        <form onSubmit={submitEmail} className="flex flex-col gap-3">
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
          <label className="flex flex-col gap-1 text-xs text-[var(--c-muted)]">
            密碼
            <input
              type="password"
              required
              minLength={8}
              autoComplete={isSignUp ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isSignUp ? "至少 8 個字元" : ""}
              className="rounded border border-[var(--c-border)] px-3 py-2 text-sm text-[var(--c-text)]"
            />
          </label>
          {error && (
            <p className="rounded bg-red-50 dark:bg-red-950/40 px-2 py-1 text-xs text-red-700 dark:text-red-300">
              {error}
            </p>
          )}
          {message && (
            <p className="rounded bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 text-xs text-emerald-800 dark:text-emerald-300">
              {message}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-sm bg-[var(--c-btn-strong-bg)] px-6 py-2.5 text-sm font-semibold text-[var(--c-btn-strong-text)] shadow-sm hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "處理中…" : isSignUp ? "建立帳號" : "Email 登入"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-[var(--c-muted)]">
          {isSignUp ? "已有帳號？" : "首次使用？"}
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
              setMessage(null);
            }}
            className="ml-1 underline hover:text-[var(--c-text)]"
          >
            {isSignUp ? "登入" : "建立帳號"}
          </button>
        </p>

        <p className="mt-4 text-[10px] text-[var(--c-faint)]">
          本站採邀請制，未在 allowlist 的 email 註冊會被拒絕。請聯絡管理員把你的 email 加入。
        </p>
      </div>
    </main>
  );
}
