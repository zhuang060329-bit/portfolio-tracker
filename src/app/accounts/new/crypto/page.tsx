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
          className="mt-6 flex flex-col gap-4 rounded-md border border-[var(--c-border)] bg-[var(--c-surface)] p-6 shadow-sm"
        >
          <label className="flex flex-col gap-1 text-xs text-[var(--c-muted)]">
            帳戶名稱
            <input
              name="name"
              required
              placeholder="例：MAX BTC"
              className="mt-1 rounded border border-[var(--c-border)] px-3 py-2 text-base text-[var(--c-text)]"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-[var(--c-muted)]">
            CoinGecko ID（不是符號）
            <input
              name="symbol"
              required
              placeholder="bitcoin / ethereum / solana"
              className="mt-1 rounded border border-[var(--c-border)] px-3 py-2 text-base text-[var(--c-text)]"
            />
            <span className="mt-1 text-[10px] text-[var(--c-faint)]">
              到 coingecko.com 搜尋幣種頁面，網址 /coins/ 後面那個 id。
            </span>
          </label>

          <label className="flex flex-col gap-1 text-xs text-[var(--c-muted)]">
            持有數量
            <input
              name="quantity"
              type="number"
              step="any"
              min="0"
              required
              placeholder="例：0.01"
              className="mt-1 rounded border border-[var(--c-border)] px-3 py-2 text-base text-[var(--c-text)]"
            />
          </label>

          {state?.error && (
            <p className="rounded bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="mt-2 self-start rounded-sm bg-[var(--c-accent)] px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "驗證並建立中…" : "建立帳戶"}
          </button>
        </form>
      </main>
    </div>
  );
}
