"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createCryptoAccount, type FormState } from "../actions";
import { AppHeader } from "@/components/AppHeader";

export default function NewCryptoPage() {
  const [state, action, pending] = useActionState<FormState, FormData>(
    createCryptoAccount,
    undefined,
  );

  return (
    <div className="min-h-screen bg-[var(--c-page)] text-[var(--c-text)]">
      <AppHeader active="accounts" />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="mb-4 text-sm">
          <Link
            href="/accounts/new"
            className="text-[var(--c-muted)] hover:text-[var(--c-text)]"
          >
            ← 回新增帳戶
          </Link>
        </div>
        <header>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">
            新增加密貨幣帳戶
          </h1>
          <p className="mt-2 text-sm text-[var(--c-muted)]">
            以 CoinGecko id 識別幣種（不是交易所 ticker）。建立時會抓 TWD 報價驗證。
          </p>
        </header>

        <form
          action={action}
          className="mt-6 overflow-hidden rounded-[var(--r-card)] border border-[var(--c-border)] bg-[var(--c-surface)] p-6 shadow-[var(--c-shadow)]"
        >
          <div className="flex flex-col gap-5">
            <label className="flex flex-col gap-[7px] text-xs font-medium text-[var(--c-muted)]">
              帳戶名稱
              <input
                name="name"
                required
                placeholder="例：MAX BTC"
                className="h-[42px] rounded-[var(--r-control)] border border-[var(--c-border)] bg-[var(--c-surface-soft)] px-3.5 text-sm text-[var(--c-text)] outline-none placeholder:text-[var(--c-faint)] focus:border-[color-mix(in_srgb,var(--c-accent)_50%,transparent)] focus:shadow-[0_0_0_3px_var(--c-accent-soft)]"
              />
            </label>

            <label className="flex flex-col gap-[7px] text-xs font-medium text-[var(--c-muted)]">
              CoinGecko ID（不是符號）
              <input
                name="symbol"
                required
                placeholder="bitcoin / ethereum / solana"
                className="h-[42px] rounded-[var(--r-control)] border border-[var(--c-border)] bg-[var(--c-surface-soft)] px-3.5 text-sm text-[var(--c-text)] outline-none placeholder:text-[var(--c-faint)] focus:border-[color-mix(in_srgb,var(--c-accent)_50%,transparent)] focus:shadow-[0_0_0_3px_var(--c-accent-soft)]"
              />
              <span className="text-[11px] text-[var(--c-faint)]">
                到 coingecko.com 搜尋幣種頁面，網址 /coins/ 後面那個 id。
              </span>
            </label>

            <label className="flex flex-col gap-[7px] text-xs font-medium text-[var(--c-muted)]">
              持有數量
              <input
                name="quantity"
                type="number"
                step="any"
                min="0"
                required
                placeholder="例：0.01"
                className="h-[42px] rounded-[var(--r-control)] border border-[var(--c-border)] bg-[var(--c-surface-soft)] px-3.5 text-sm text-[var(--c-text)] outline-none placeholder:text-[var(--c-faint)] focus:border-[color-mix(in_srgb,var(--c-accent)_50%,transparent)] focus:shadow-[0_0_0_3px_var(--c-accent-soft)]"
              />
            </label>

            {state?.error && (
              <p className="rounded-[var(--r-control)] border border-[color-mix(in_srgb,var(--c-down)_30%,transparent)] bg-[color-mix(in_srgb,var(--c-down)_10%,var(--c-surface))] px-3.5 py-2.5 text-sm text-[var(--c-down)]">
                {state.error}
              </p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="mt-1 self-start rounded-[var(--r-control)] bg-[var(--c-accent)] px-6 py-2.5 text-sm font-semibold text-[var(--c-btn-strong-text)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {pending ? "驗證並建立中…" : "建立帳戶"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
