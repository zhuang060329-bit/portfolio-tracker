"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addByAmount, type FormState } from "@/app/accounts/[id]/actions";

type Account = {
  id: string;
  name: string;
  symbol: string | null;
  price_market: string;
  native_currency: string;
  last_unit_price: number | null;
  last_fx_rate: number;
};

const fmtTwd = (n: number) =>
  n.toLocaleString("zh-TW", { maximumFractionDigits: 0 });

const fmtShares = (n: number) =>
  n.toLocaleString("en-US", { maximumFractionDigits: 6 });

/**
 * 浮動快速記帳按鈕（Midnight Ledger 樣式）。
 * 從首頁傳入 active 非手動帳戶清單，選帳戶 + 輸入 TWD 金額即可記錄加碼。
 * - 預覽即時算 TWD ÷ (現價 × 匯率) = 預計購入股數
 * - 提交成功後關閉並 revalidate（addByAmount 內已有）
 */
export function QuickAddFab({ accounts }: { accounts: Account[] }) {
  const [open, setOpen] = useState(false);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [twd, setTwd] = useState("");
  const [state, action, pending] = useActionState<FormState, FormData>(
    addByAmount,
    undefined,
  );
  const dialogRef = useRef<HTMLDivElement>(null);

  // submit 成功（pending true → false 且無 error）→ 關閉、清表單
  const prevPending = useRef(false);
  useEffect(() => {
    if (prevPending.current && !pending && !state?.error) {
      setOpen(false);
      setTwd("");
    }
    prevPending.current = pending;
  }, [pending, state]);

  // Esc 關閉
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const account = accounts.find((a) => a.id === accountId);
  const twdNum = Number(twd);
  const perShare =
    account && account.last_unit_price
      ? Number(account.last_unit_price) * Number(account.last_fx_rate ?? 1)
      : 0;
  const previewShares =
    Number.isFinite(twdNum) && twdNum > 0 && perShare > 0
      ? twdNum / perShare
      : 0;
  const accountMissingPrice = !!account && !(perShare > 0);

  if (accounts.length === 0) return null;

  const fieldCls =
    "mt-1 h-[42px] rounded-[10px] border border-[var(--c-border)] bg-[var(--c-surface-soft)] px-3.5 text-sm text-[var(--c-text)] outline-none focus:border-[color-mix(in_srgb,var(--c-accent)_50%,transparent)] focus:shadow-[0_0_0_3px_var(--c-accent-soft)]";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="快速加碼"
        className="fixed bottom-5 right-5 z-40 grid h-14 w-14 place-items-center rounded-[18px] bg-[var(--c-accent)] text-[#1a1408] shadow-[0_6px_20px_rgba(0,0,0,0.35)] transition-transform hover:-translate-y-0.5 active:scale-95 sm:bottom-8 sm:right-8"
      >
        <svg
          viewBox="0 0 24 24"
          width={26}
          height={26}
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="快速加碼"
            className="w-full max-w-md rounded-t-2xl border border-[var(--c-line-strong)] bg-[var(--c-surface)] p-5 shadow-[var(--c-shadow)] sm:rounded-2xl sm:px-6"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-[19px] font-medium tracking-tight">
                快速加碼
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="關閉"
                className="grid h-8 w-8 place-items-center rounded-lg text-[var(--c-muted)] hover:bg-[var(--c-surface-soft)] hover:text-[var(--c-text)]"
              >
                <svg
                  viewBox="0 0 24 24"
                  width={20}
                  height={20}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M6 6l12 12M6 18L18 6" />
                </svg>
              </button>
            </div>

            <form action={action} className="mt-4 flex flex-col gap-3">
              <input type="hidden" name="accountId" value={accountId} />

              <label className="flex flex-col gap-1 text-xs font-medium text-[var(--c-muted)]">
                帳戶
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className={fieldCls}
                  required
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                      {a.symbol ? ` · ${a.symbol}` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-xs font-medium text-[var(--c-muted)]">
                投入金額（TWD）
                <input
                  name="twd"
                  type="number"
                  step="any"
                  min="0"
                  required
                  inputMode="decimal"
                  autoFocus
                  value={twd}
                  onChange={(e) => setTwd(e.target.value)}
                  placeholder="例：50000"
                  className={`${fieldCls} tnum text-base`}
                />
              </label>

              {/* 預覽：用當前市價 + 匯率算購入股數 */}
              {account && (
                <div className="rounded-[10px] bg-[var(--c-surface-soft)] px-3.5 py-2.5 text-xs text-[var(--c-muted)]">
                  <div className="flex justify-between">
                    <span>現價</span>
                    <span className="tnum text-[var(--c-text)]">
                      {account.last_unit_price
                        ? `${account.native_currency} ${account.last_unit_price}`
                        : "—"}
                    </span>
                  </div>
                  {Number(account.last_fx_rate ?? 1) !== 1 && (
                    <div className="mt-1 flex justify-between">
                      <span>匯率</span>
                      <span className="tnum text-[var(--c-text)]">
                        {account.last_fx_rate}
                      </span>
                    </div>
                  )}
                  <div className="mt-1.5 flex justify-between border-t border-[var(--c-border)] pt-1.5">
                    <span>預計購入</span>
                    <span className="tnum font-semibold text-[var(--c-text)]">
                      {previewShares > 0
                        ? `${fmtShares(previewShares)} 股`
                        : "—"}
                    </span>
                  </div>
                  {twdNum > 0 && (
                    <div className="mt-1 flex justify-between text-[10px]">
                      <span>= TWD</span>
                      <span className="tnum">{fmtTwd(twdNum)}</span>
                    </div>
                  )}
                </div>
              )}

              {accountMissingPrice && (
                <p className="rounded-lg bg-[color-mix(in_srgb,#E0B15F_14%,transparent)] px-3 py-2 text-xs text-[#E0B15F]">
                  此帳戶目前沒有市價，先到帳戶詳情頁按「更新價格」抓一次再回來。
                </p>
              )}
              {state?.error && (
                <p className="rounded-lg bg-[color-mix(in_srgb,var(--c-down)_14%,transparent)] px-3 py-2 text-xs text-[var(--c-down)]">
                  {state.error}
                </p>
              )}

              <button
                type="submit"
                disabled={
                  pending || !accountId || !(twdNum > 0) || accountMissingPrice
                }
                className="mt-2 rounded-[10px] bg-[var(--c-accent)] px-5 py-3 text-sm font-semibold text-[#1a1408] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending ? "記錄中…" : "確認加碼"}
              </button>

              <p className="text-[10px] text-[var(--c-faint)]">
                依當前市價自動換算股數；要客製成交價/匯率/時間請進帳戶詳情頁的「加碼買入」。
              </p>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
