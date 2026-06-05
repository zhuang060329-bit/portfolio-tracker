"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createStockAccount, type FormState } from "../actions";
import { AppHeader } from "@/components/AppHeader";

export default function NewStockPage() {
  const [state, action, pending] = useActionState<FormState, FormData>(
    createStockAccount,
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
            ← Back to add account
          </Link>
        </div>
        <header>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">
            Add stock account
          </h1>
          <p className="mt-2 text-sm text-[var(--c-muted)]">
            建立時即時抓一次價格驗證 symbol；失敗會提示重輸。
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
              placeholder="例：永豐複委託 QQQM"
              className="mt-1 rounded border border-[var(--c-border)] px-3 py-2 text-base text-[var(--c-text)]"
            />
          </label>

          <fieldset className="flex flex-col gap-1 text-xs text-[var(--c-muted)]">
            市場
            <div className="mt-1 flex gap-2">
              <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-2 text-sm has-[:checked]:border-[var(--c-accent)] has-[:checked]:bg-[var(--c-accent)]/5">
                <input type="radio" name="market" value="us" defaultChecked />
                <span className="text-[var(--c-text)]">美股</span>
              </label>
              <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-2 text-sm has-[:checked]:border-[var(--c-accent)] has-[:checked]:bg-[var(--c-accent)]/5">
                <input type="radio" name="market" value="tw" />
                <span className="text-[var(--c-text)]">台股</span>
              </label>
            </div>
          </fieldset>

          <label className="flex flex-col gap-1 text-xs text-[var(--c-muted)]">
            Symbol（美股 ticker 或台股代號）
            <input
              name="symbol"
              required
              placeholder="QQQM 或 2330"
              className="mt-1 rounded border border-[var(--c-border)] px-3 py-2 text-base text-[var(--c-text)]"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-[var(--c-muted)]">
            持有股數
            <input
              name="quantity"
              type="number"
              step="any"
              min="0"
              required
              placeholder="例：1.37164"
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
