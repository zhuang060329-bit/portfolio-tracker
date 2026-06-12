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
            ← 回新增帳戶
          </Link>
        </div>
        <header>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">
            新增股票帳戶
          </h1>
          <p className="mt-2 text-sm text-[var(--c-muted)]">
            建立時即時抓一次價格驗證 symbol；失敗會提示重輸。
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
                placeholder="例：永豐複委託 QQQM"
                className="h-[42px] rounded-[var(--r-control)] border border-[var(--c-border)] bg-[var(--c-surface-soft)] px-3.5 text-sm text-[var(--c-text)] outline-none placeholder:text-[var(--c-faint)] focus:border-[color-mix(in_srgb,var(--c-accent)_50%,transparent)] focus:shadow-[0_0_0_3px_var(--c-accent-soft)]"
              />
            </label>

            <fieldset className="flex flex-col gap-[7px] text-xs font-medium text-[var(--c-muted)]">
              市場
              <div className="mt-0.5 flex gap-2">
                <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-[var(--r-control)] border border-[var(--c-border)] bg-[var(--c-surface-soft)] px-3 py-2.5 text-[13px] font-medium transition-all has-[:checked]:border-[color-mix(in_srgb,var(--c-accent)_50%,transparent)] has-[:checked]:bg-[var(--c-accent-soft)] has-[:checked]:text-[var(--c-accent)]">
                  <input type="radio" name="market" value="us" defaultChecked className="sr-only" />
                  美股
                </label>
                <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-[var(--r-control)] border border-[var(--c-border)] bg-[var(--c-surface-soft)] px-3 py-2.5 text-[13px] font-medium transition-all has-[:checked]:border-[color-mix(in_srgb,var(--c-accent)_50%,transparent)] has-[:checked]:bg-[var(--c-accent-soft)] has-[:checked]:text-[var(--c-accent)]">
                  <input type="radio" name="market" value="tw" className="sr-only" />
                  台股
                </label>
              </div>
            </fieldset>

            <label className="flex flex-col gap-[7px] text-xs font-medium text-[var(--c-muted)]">
              Symbol（美股 ticker 或台股代號）
              <input
                name="symbol"
                required
                placeholder="QQQM 或 2330"
                className="h-[42px] rounded-[var(--r-control)] border border-[var(--c-border)] bg-[var(--c-surface-soft)] px-3.5 text-sm text-[var(--c-text)] outline-none placeholder:text-[var(--c-faint)] focus:border-[color-mix(in_srgb,var(--c-accent)_50%,transparent)] focus:shadow-[0_0_0_3px_var(--c-accent-soft)]"
              />
            </label>

            <label className="flex flex-col gap-[7px] text-xs font-medium text-[var(--c-muted)]">
              持有股數
              <input
                name="quantity"
                type="number"
                step="any"
                min="0"
                required
                placeholder="例：1.37164"
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
              className="mt-1 self-start rounded-[var(--r-control)] bg-[var(--c-accent)] px-6 py-2.5 text-sm font-semibold text-[#1a1408] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {pending ? "驗證並建立中…" : "建立帳戶"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
