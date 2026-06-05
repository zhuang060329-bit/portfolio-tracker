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
        Import CSV（僅支援配息 / 利息）
      </summary>
      <form
        action={action}
        className="flex flex-col gap-3 border-t border-[var(--c-border)] p-4"
        encType="multipart/form-data"
      >
        <div className="rounded-sm border border-[var(--c-border)] bg-[var(--c-surface-soft)] px-3 py-2 text-xs text-[var(--c-muted)]">
          <p className="font-medium text-[var(--c-text)]">CSV 格式：</p>
          <code className="block mt-1 font-mono text-[11px]">
            date,account,type,amount_twd,note<br />
            2026-05-01,QQQM 國泰證券,dividend,200,Q1 配息<br />
            2026-04-15,玉山活儲,interest,50,
          </code>
          <p className="mt-1">
            account 需與你建立的帳戶名稱完全一致。type 限 dividend / interest。amount_twd 為正數。
          </p>
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
