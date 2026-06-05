"use client";

import { useActionState } from "react";
import { importIncomeCsv, type ImportResult } from "./actions";

export function ImportCsv() {
  const [state, action, pending] = useActionState<ImportResult, FormData>(
    importIncomeCsv,
    undefined,
  );

  return (
    <details className="rounded-md border border-[var(--c-border)] bg-[var(--c-surface)]">
      <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium">
        匯入 CSV（配息 / 利息，支援中英文欄位）
      </summary>
      <form
        action={action}
        className="flex flex-col gap-3 border-t border-[var(--c-border)] p-4"
        encType="multipart/form-data"
      >
        <div className="rounded-sm border border-[var(--c-border)] bg-[var(--c-surface-soft)] px-3 py-2 text-xs text-[var(--c-muted)]">
          <p className="font-medium text-[var(--c-text)]">支援的欄位（任一即可）</p>
          <ul className="mt-1 list-disc pl-4 text-[11px]">
            <li>日期：date / 日期 / 成交日（接受 2026-05-01 / 2026/5/1 / 5/1/2026）</li>
            <li>帳戶：account / 帳戶 / 標的（須與帳戶名稱完全一致）</li>
            <li>類型：type / 類型（配息 / 股息 / dividend / 利息 / interest）</li>
            <li>金額：amount / amount_twd / 金額（正數，會自動去除逗號與 NT$）</li>
            <li>備註：note / 備註（選填）</li>
          </ul>
          <p className="mt-2 font-medium text-[var(--c-text)]">範例：</p>
          <code className="block mt-1 font-mono text-[11px]">
            日期,帳戶,類型,金額,備註<br />
            2026-05-01,QQQM 國泰證券,配息,NT$ 1,200,Q1 配息<br />
            2026/4/15,玉山活儲,利息,50,
          </code>
        </div>
        <input
          name="file"
          type="file"
          accept=".csv,text/csv"
          required
          className="text-sm text-[var(--c-text)] file:mr-3 file:rounded-sm file:border-0 file:bg-[var(--c-btn-strong-bg)] file:px-3 file:py-1 file:text-xs file:font-medium file:text-[var(--c-btn-strong-text)]"
        />
        {state && (state.ok === false ? (
          <p className="rounded bg-red-50 dark:bg-red-950/40 px-2 py-1 text-xs text-red-700 dark:text-red-300">
            {state.error}
          </p>
        ) : state.ok === true ? (
          <div className="rounded bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 text-xs text-emerald-800 dark:text-emerald-300">
            <div>匯入 {state.imported} 筆 · 跳過 {state.skipped} 筆</div>
            {state.errors.length > 0 && (
              <ul className="mt-1 list-disc pl-4 text-[10px] text-red-700 dark:text-red-300">
                {state.errors.slice(0, 5).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
                {state.errors.length > 5 && (
                  <li>… 還有 {state.errors.length - 5} 筆錯誤</li>
                )}
              </ul>
            )}
          </div>
        ) : null)}
        <button
          type="submit"
          disabled={pending}
          className="self-start rounded-sm bg-[var(--c-btn-strong-bg)] px-4 py-1.5 text-sm font-medium text-[var(--c-btn-strong-text)] hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "匯入中…" : "上傳並匯入"}
        </button>
      </form>
    </details>
  );
}
