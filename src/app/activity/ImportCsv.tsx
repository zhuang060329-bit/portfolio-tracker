"use client";

import { useState } from "react";
import { useActionState } from "react";
import { importIncomeCsv, type ImportResult } from "./actions";

// Midnight Ledger 風格的可收合匯入面板，沿用真實的 importIncomeCsv server action。
export function ImportCsv() {
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [state, action, pending] = useActionState<ImportResult, FormData>(
    importIncomeCsv,
    undefined,
  );

  return (
    <div className="w-full overflow-hidden rounded-[11px] border border-[var(--c-border)] bg-[var(--c-surface)]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 w-full items-center gap-2 px-4 text-[13.5px] font-medium text-[var(--c-text)]"
      >
        <span
          className={`text-[10px] text-[var(--c-muted)] transition-transform ${
            open ? "rotate-90" : ""
          }`}
        >
          ▸
        </span>
        匯入 CSV
        <span className="ml-auto truncate text-[11.5px] font-normal text-[var(--c-faint)]">
          配息 / 利息 · 支援中英文欄位
        </span>
      </button>

      {open && (
        <form
          action={action}
          encType="multipart/form-data"
          className="flex flex-col gap-3 border-t border-[var(--c-border)] p-4"
        >
          <div className="rounded-[9px] bg-[var(--c-surface-soft)] px-3 py-2.5 text-[11.5px] text-[var(--c-muted)]">
            <p className="mb-1.5 font-semibold text-[var(--c-text)]">
              支援的欄位（任一即可）
            </p>
            <ul className="flex flex-col gap-[3px]">
              <li>
                <b className="font-semibold text-[var(--c-text)]">日期</b> date /
                日期 / 成交日（2026-05-01 / 2026/5/1 / 5/1/2026）
              </li>
              <li>
                <b className="font-semibold text-[var(--c-text)]">帳戶</b> account
                / 帳戶 / 標的（須與帳戶名稱一致）
              </li>
              <li>
                <b className="font-semibold text-[var(--c-text)]">類型</b> type /
                類型（配息 / dividend / 利息 / interest）
              </li>
              <li>
                <b className="font-semibold text-[var(--c-text)]">金額</b> amount /
                金額（正數，自動去除逗號與 NT$）
              </li>
              <li>
                <b className="font-semibold text-[var(--c-text)]">備註</b> note /
                備註（選填）
              </li>
            </ul>
          </div>

          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-[10px] border border-dashed border-[var(--c-line-strong)] bg-[var(--c-surface-soft)] px-4 py-5 text-center text-[12.5px] text-[var(--c-muted)] hover:border-[var(--c-accent)]">
            <span className="text-lg text-[var(--c-faint)]">⬆</span>
            <span>
              {fileName ? (
                <span className="text-[var(--c-text)]">{fileName}</span>
              ) : (
                <>
                  點擊選擇 CSV <span className="text-[var(--c-faint)]">檔案</span>
                </>
              )}
            </span>
            <input
              name="file"
              type="file"
              accept=".csv,text/csv"
              required
              hidden
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
            />
          </label>

          {state &&
            (state.ok === false ? (
              <p className="rounded bg-[color-mix(in_srgb,var(--c-down)_14%,transparent)] px-2 py-1 text-xs text-[var(--c-down)]">
                {state.error}
              </p>
            ) : state.ok === true ? (
              <div className="rounded bg-[color-mix(in_srgb,var(--c-up)_14%,transparent)] px-2 py-1 text-xs text-[var(--c-up)]">
                <div>
                  匯入 {state.imported} 筆 · 跳過 {state.skipped} 筆
                </div>
                {state.errors.length > 0 && (
                  <ul className="mt-1 list-disc pl-4 text-[10px] text-[var(--c-down)]">
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
            className="self-start rounded-[9px] bg-[var(--c-accent)] px-4 py-2 text-[13.5px] font-semibold text-[var(--c-btn-strong-text)] transition hover:brightness-110 disabled:opacity-50"
          >
            {pending ? "匯入中…" : "上傳並匯入"}
          </button>
        </form>
      )}
    </div>
  );
}
