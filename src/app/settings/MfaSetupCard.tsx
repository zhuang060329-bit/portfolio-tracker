"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * MFA 設定卡片（Midnight Ledger 風格）。
 * 邏輯沿用既有 MfaSetup（supabase.auth.mfa）；只重寫樣式：
 * - 列「雙因素驗證 (MFA)」一列含 toggle / 已啟用徽章
 * - 開啟 enrollment 後展開 QR + 6 碼驗證 panel
 * - 啟用後顯示綠色「MFA 已啟用」+ 停用按鈕
 */

type Factor = {
  id: string;
  factor_type: string;
  status: string;
  friendly_name?: string | null;
};

type Step = "off" | "setup" | "on";

export function MfaSetupCard() {
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

  const supabase = createClient();

  async function load() {
    setLoading(true);
    const { data, error: e } = await supabase.auth.mfa.listFactors();
    if (e) setError(e.message);
    setFactors((data?.totp ?? []) as Factor[]);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startEnroll() {
    setError(null);
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
    await load();
  }

  async function cancelEnroll() {
    if (!enrollment) return;
    await supabase.auth.mfa.unenroll({ factorId: enrollment.factorId });
    setEnrollment(null);
    setCode("");
  }

  async function disable(factorId: string) {
    if (!confirm("確定關閉 MFA？關閉後登入只需密碼或 Google 帳號。")) return;
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.auth.mfa.unenroll({ factorId });
    setBusy(false);
    if (e) {
      setError(e.message);
      return;
    }
    await load();
  }

  const verified = factors.find((f) => f.status === "verified");
  const unverified = factors.find((f) => f.status === "unverified");
  const step: Step = verified
    ? "on"
    : enrollment || unverified
      ? "setup"
      : "off";

  if (loading) {
    return (
      <p className="text-sm text-[var(--c-muted)]">讀取中…</p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-4 py-3.5">
        <div className="min-w-0">
          <span className="text-[14px] font-medium text-[var(--c-text)]">
            雙因素驗證 (MFA)
          </span>
          <span className="mt-0.5 block text-[12px] text-[var(--c-muted)]">
            登入時額外要求 Authenticator 6 位數驗證碼
          </span>
        </div>
        <div className="flex-shrink-0">
          {step === "on" ? (
            <span className="text-[12.5px] font-semibold text-[var(--c-up)]">
              ● 已啟用
            </span>
          ) : (
            <Toggle
              on={step !== "off"}
              onClick={() => {
                if (step === "off") startEnroll();
                else if (enrollment) cancelEnroll();
                else if (unverified) disable(unverified.id);
              }}
              busy={busy}
            />
          )}
        </div>
      </div>

      {/* Enrollment panel */}
      {enrollment && (
        <div className="animate-[reveal_.25s_ease] rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-soft)] p-5">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <div className="flex flex-col items-center gap-2">
              <div className="rounded-lg border border-[var(--c-line-strong)] bg-[var(--c-surface)] p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={enrollment.qr}
                  alt="MFA QR code"
                  width={120}
                  height={120}
                  className="block h-[120px] w-[120px]"
                />
              </div>
              <span className="text-[11.5px] text-[var(--c-muted)]">
                用 Authenticator 掃描
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <p className="mb-2 text-[12.5px] text-[var(--c-muted)]">
                1 · 掃描 QR，或手動輸入金鑰：
              </p>
              <code className="mb-4 block select-all rounded-lg border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-2.5 font-mono text-[14px] font-semibold tracking-[0.08em] text-[var(--c-accent)]">
                {enrollment.secret}
              </code>
              <p className="mb-2 text-[12.5px] text-[var(--c-muted)]">
                2 · 輸入 App 顯示的 6 位數驗證碼：
              </p>
              <div className="flex flex-wrap items-center gap-2.5">
                <input
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="000000"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  className="tnum h-10 w-[120px] rounded-lg border border-[var(--c-border)] bg-[var(--c-surface)] px-3.5 text-center text-[18px] font-semibold tracking-[0.3em] text-[var(--c-text)] outline-none focus:border-[color-mix(in_srgb,var(--c-accent)_50%,transparent)] focus:ring-2 focus:ring-[var(--c-accent-soft)]"
                />
                <button
                  type="button"
                  onClick={verify}
                  disabled={busy || code.length !== 6}
                  className="whitespace-nowrap rounded-lg bg-[var(--c-accent)] px-4 py-2.5 text-[13px] font-semibold text-[#1a1408] transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {busy ? "驗證中…" : "驗證並啟用"}
                </button>
                <button
                  type="button"
                  onClick={cancelEnroll}
                  disabled={busy}
                  className="rounded-lg border border-[var(--c-line-strong)] bg-[var(--c-surface)] px-3 py-2 text-[13px] text-[var(--c-text)]"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 已啟用：顯示 done card */}
      {verified && (
        <div className="flex flex-wrap items-center justify-between gap-3.5 rounded-xl border border-[color-mix(in_srgb,var(--c-up)_28%,transparent)] bg-[color-mix(in_srgb,var(--c-up)_10%,var(--c-surface-soft))] px-4 py-3.5">
          <span className="text-[13px] text-[var(--c-text)]">
            MFA 已啟用，下次登入會要求驗證碼。
          </span>
          <button
            type="button"
            onClick={() => disable(verified.id)}
            disabled={busy}
            className="whitespace-nowrap rounded-lg border border-[color-mix(in_srgb,var(--c-down)_35%,transparent)] bg-[var(--c-surface)] px-4 py-2 text-[13px] font-medium text-[var(--c-down)] hover:bg-[color-mix(in_srgb,var(--c-down)_12%,transparent)] disabled:opacity-50"
          >
            停用 MFA
          </button>
        </div>
      )}

      {/* 卡住的 unverified factor */}
      {unverified && !enrollment && step !== "on" && (
        <p className="text-[12px] text-[var(--c-down)]">
          偵測到上次未完成的 enrollment，
          <button
            type="button"
            onClick={() => disable(unverified.id)}
            className="ml-1 underline"
          >
            清除
          </button>
        </p>
      )}

      {error && (
        <p className="rounded-lg border border-[color-mix(in_srgb,var(--c-down)_35%,transparent)] bg-[color-mix(in_srgb,var(--c-down)_8%,transparent)] px-3 py-2 text-[12px] text-[var(--c-down)]">
          {error}
        </p>
      )}

      <p className="text-[11px] text-[var(--c-faint)]">
        本 app 在登入時會強制 AAL2 升級；啟用後若無法登入，可請 admin 至 Supabase 後台移除 factor。
      </p>

      <style jsx>{`
        @keyframes reveal {
          from {
            opacity: 0;
            transform: translateY(-5px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

function Toggle({
  on,
  onClick,
  busy,
}: {
  on: boolean;
  onClick: () => void;
  busy: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onClick}
      disabled={busy}
      className={`relative h-6 w-[42px] rounded-full border transition-colors disabled:opacity-50 ${
        on
          ? "border-[var(--c-up)] bg-[var(--c-up)]"
          : "border-[var(--c-line-strong)] bg-[var(--c-surface-soft)]"
      }`}
    >
      <span
        className={`absolute top-[2px] block h-[18px] w-[18px] rounded-full shadow-[0_1px_2px_rgba(0,0,0,.3)] transition-transform ${
          on ? "translate-x-[20px] bg-white" : "translate-x-[2px] bg-[var(--c-text)]"
        }`}
      />
    </button>
  );
}
