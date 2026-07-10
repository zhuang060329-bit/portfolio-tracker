"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { safeInternalPath } from "@/lib/safe-redirect";

export function MfaVerifyForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeInternalPath(params.get("next"));

  const [factorId, setFactorId] = useState<string | null>(null);
  const [factorName, setFactorName] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    (async () => {
      const { data, error: e } = await supabase.auth.mfa.listFactors();
      if (e) setError(e.message);
      const verified = (data?.totp ?? []).find((f) => f.status === "verified");
      if (verified) {
        setFactorId(verified.id);
        setFactorName(verified.friendly_name ?? "TOTP");
      } else {
        router.replace(next);
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId || code.length < 6) return;
    setBusy(true);
    setError(null);
    const { data: ch, error: e1 } = await supabase.auth.mfa.challenge({
      factorId,
    });
    if (e1 || !ch) {
      setBusy(false);
      setError(e1?.message ?? "challenge 失敗");
      return;
    }
    const { error: e2 } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: ch.id,
      code,
    });
    if (e2) {
      setBusy(false);
      setError(e2.message);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <div className="w-full max-w-sm rounded-[var(--r-card)] border border-[var(--c-border)] bg-[var(--c-surface)] p-8 shadow-[var(--c-shadow)]">
      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-[var(--c-text)]">
          驗證碼
        </h1>
        <p className="text-sm text-[var(--c-muted)]">
          {loading
            ? "讀取中…"
            : factorName
              ? `輸入 ${factorName} 產生的 6 位數碼以繼續`
              : "未設定 MFA"}
        </p>
      </div>
      {factorId && (
        <form onSubmit={submit} className="mt-6 flex flex-col gap-3">
          <input
            value={code}
            onChange={(e) =>
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            placeholder="000000"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            maxLength={6}
            className="w-full rounded-[var(--r-control)] border border-[var(--c-border)] bg-[var(--c-surface-soft)] px-3 py-2 text-center text-lg tabular-nums [font-variant-numeric:lining-nums_tabular-nums] tracking-widest text-[var(--c-text)] outline-none focus:border-[color-mix(in_srgb,var(--c-accent)_50%,transparent)] focus:shadow-[0_0_0_3px_var(--c-accent-soft)]"
          />
          {error && (
            <p className="rounded-[var(--r-control)] border border-[color-mix(in_srgb,var(--c-down)_30%,transparent)] bg-[color-mix(in_srgb,var(--c-down)_10%,var(--c-surface))] px-2 py-1 text-xs text-[var(--c-down)]">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy || code.length < 6}
            className="w-full rounded-[var(--r-control)] bg-[var(--c-accent)] px-6 py-3 text-sm font-semibold text-[var(--c-btn-strong-text)] hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "驗證中…" : "驗證"}
          </button>
        </form>
      )}
      <form action="/auth/signout" method="post" className="mt-4">
        <button
          type="submit"
          className="w-full text-xs text-[var(--c-muted)] underline hover:text-[var(--c-text)]"
        >
          登出（換帳號或忘記驗證碼）
        </button>
      </form>
    </div>
  );
}
