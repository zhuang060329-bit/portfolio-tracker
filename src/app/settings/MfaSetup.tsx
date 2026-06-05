"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Factor = {
  id: string;
  factor_type: string;
  status: string;
  friendly_name?: string | null;
};

export function MfaSetup() {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrollment, setEnrollment] = useState<{
    factorId: string;
    qr: string;
    secret: string;
  } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const supabase = createClient();

  async function load() {
    setLoading(true);
    const { data, error: e } = await supabase.auth.mfa.listFactors();
    if (e) setError(e.message);
    setFactors((data?.totp ?? []) as Factor[]);
    setLoading(false);
  }

  useEffect(() => {
    // mount-once fetch；async + setState pattern is intentional here
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startEnroll() {
    setError(null);
    setMessage(null);
    setBusy(true);
    const { data, error: e } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `TOTP ${new Date().toISOString().slice(0, 10)}`,
    });
    setBusy(false);
    if (e || !data) {
      setError(e?.message ?? "啟用失敗");
      return;
    }
    setEnrollment({
      factorId: data.id,
      qr: data.totp.qr_code,
      secret: data.totp.secret,
    });
  }

  async function verify() {
    if (!enrollment) return;
    if (code.length < 6) {
      setError("請輸入 6 位數驗證碼");
      return;
    }
    setBusy(true);
    setError(null);
    const { data: ch, error: e1 } = await supabase.auth.mfa.challenge({
      factorId: enrollment.factorId,
    });
    if (e1 || !ch) {
      setBusy(false);
      setError(e1?.message ?? "challenge 失敗");
      return;
    }
    const { error: e2 } = await supabase.auth.mfa.verify({
      factorId: enrollment.factorId,
      challengeId: ch.id,
      code,
    });
    setBusy(false);
    if (e2) {
      setError(e2.message);
      return;
    }
    setEnrollment(null);
    setCode("");
    setMessage("MFA 啟用成功");
    await load();
  }

  async function cancelEnroll() {
    if (!enrollment) return;
    await supabase.auth.mfa.unenroll({ factorId: enrollment.factorId });
    setEnrollment(null);
    setCode("");
  }

  async function disable(factorId: string) {
    if (!confirm("確定關閉 MFA？關閉後登入只需 Google 帳號。")) return;
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.auth.mfa.unenroll({ factorId });
    setBusy(false);
    if (e) {
      setError(e.message);
      return;
    }
    setMessage("MFA 已關閉");
    await load();
  }

  if (loading) return <p className="text-sm text-[var(--c-muted)]">讀取中…</p>;

  const verified = factors.find((f) => f.status === "verified");
  const unverified = factors.find((f) => f.status === "unverified");

  return (
    <div className="flex flex-col gap-3">
      {verified ? (
        <div className="flex items-center justify-between gap-3 rounded-sm border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 text-sm">
          <span className="text-emerald-800 dark:text-emerald-300">
            ✓ MFA 已啟用（{verified.friendly_name ?? "TOTP"}）
          </span>
          <button
            type="button"
            onClick={() => disable(verified.id)}
            disabled={busy}
            className="text-xs text-emerald-800 dark:text-emerald-300 underline hover:text-red-700 dark:hover:text-red-400 disabled:opacity-50"
          >
            關閉
          </button>
        </div>
      ) : enrollment ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-[var(--c-text)]">
            用 Google Authenticator / Authy 等 app 掃 QR：
          </p>
          <div className="self-start rounded-sm border border-[var(--c-border)] bg-[var(--c-surface)] p-3">
            {/* Supabase 回傳的 qr 已是 data: URI（SVG/PNG） */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={enrollment.qr}
              alt="MFA QR code"
              width={192}
              height={192}
              className="block h-48 w-48"
            />
          </div>
          <p className="text-xs text-[var(--c-muted)]">
            無法掃描？手動輸入這串 key：
            <code className="ml-1 select-all rounded bg-[var(--c-surface-soft)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--c-text)]">
              {enrollment.secret}
            </code>
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="6 位數"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              className="w-32 rounded border border-[var(--c-border)] px-2 py-1.5 text-sm tabular-nums [font-variant-numeric:lining-nums_tabular-nums]"
            />
            <button
              type="button"
              onClick={verify}
              disabled={busy || code.length < 6}
              className="rounded-sm bg-[var(--c-accent)] px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "驗證中…" : "驗證並啟用"}
            </button>
            <button
              type="button"
              onClick={cancelEnroll}
              disabled={busy}
              className="rounded-sm border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-1.5 text-xs text-[var(--c-text)]"
            >
              取消
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-[var(--c-muted)]">
            目前未啟用 MFA。建議啟用以提高帳號安全。
          </p>
          {unverified && (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              偵測到上次未完成的 enrollment，先取消再重新啟用：
              <button
                type="button"
                onClick={() => disable(unverified.id)}
                className="ml-1 underline"
              >
                清除
              </button>
            </p>
          )}
          <button
            type="button"
            onClick={startEnroll}
            disabled={busy || !!unverified}
            className="self-start rounded-sm bg-[var(--c-accent)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "處理中…" : "啟用 MFA（TOTP）"}
          </button>
        </div>
      )}
      {error && (
        <p className="rounded bg-red-50 dark:bg-red-950/40 px-2 py-1 text-xs text-red-700 dark:text-red-300">{error}</p>
      )}
      {message && (
        <p className="rounded bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 text-xs text-emerald-800 dark:text-emerald-300">
          {message}
        </p>
      )}
      <p className="mt-1 text-[11px] text-[var(--c-faint)]">
        ⚠ 本 app 目前未實作登入時的 MFA 驗證步驟（AAL2 升級），啟用後若無法登入，可在 Supabase 後台 Authentication → Users 將自己的 factor 移除。
      </p>
    </div>
  );
}
