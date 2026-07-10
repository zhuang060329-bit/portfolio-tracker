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

const fmtTwd = (value: number) =>
  value.toLocaleString("zh-TW", { maximumFractionDigits: 0 });
const fmtShares = (value: number) =>
  value.toLocaleString("en-US", { maximumFractionDigits: 6 });

export function QuickAddFab({ accounts }: { accounts: Account[] }) {
  const [open, setOpen] = useState(false);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [twd, setTwd] = useState("");
  const [state, action, pending] = useActionState<FormState, FormData>(
    addByAmount,
    undefined,
  );
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const previousPending = useRef(false);

  useEffect(() => {
    if (previousPending.current && !pending && !state?.error) {
      setOpen(false);
      setTwd("");
    }
    previousPending.current = pending;
  }, [pending, state]);

  useEffect(() => {
    if (!open) return;

    restoreRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusables = () =>
      Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
    focusables()[0]?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const elements = focusables();
      if (elements.length === 0) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
      restoreRef.current?.focus();
    };
  }, [open]);

  const account = accounts.find((item) => item.id === accountId);
  const twdNumber = Number(twd);
  const perShare =
    account && account.last_unit_price
      ? Number(account.last_unit_price) * Number(account.last_fx_rate ?? 1)
      : 0;
  const previewShares =
    Number.isFinite(twdNumber) && twdNumber > 0 && perShare > 0
      ? twdNumber / perShare
      : 0;
  const accountMissingPrice = Boolean(account) && !(perShare > 0);

  if (accounts.length === 0) return null;

  const fieldClass =
    "mt-1 h-11 rounded-[var(--r-control)] border border-[var(--c-border)] bg-[var(--c-surface-soft)] px-3.5 text-sm text-[var(--c-text)] outline-none focus:border-[color-mix(in_srgb,var(--c-accent)_50%,transparent)] focus:shadow-[0_0_0_3px_var(--c-accent-soft)]";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="快速加碼"
        className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-40 grid h-[52px] w-[52px] place-items-center rounded-[14px] bg-[var(--c-accent)] text-[var(--c-btn-strong-text)] shadow-[0_8px_22px_rgba(0,0,0,0.28)] hover:-translate-y-0.5 sm:hidden"
      >
        <svg
          viewBox="0 0 24 24"
          width={24}
          height={24}
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 backdrop-blur-[2px] sm:items-center sm:p-5"
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="快速加碼"
            className="safe-bottom max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-[14px] border border-[var(--c-line-strong)] bg-[var(--c-surface)] p-4 shadow-[var(--c-shadow)] sm:rounded-[var(--r-card)] sm:p-6"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-[18px] font-semibold tracking-[-0.02em]">
                快速加碼
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="關閉"
                className="grid h-10 w-10 place-items-center rounded-[var(--r-control)] text-[var(--c-muted)] hover:bg-[var(--c-surface-soft)] hover:text-[var(--c-text)]"
              >
                <svg
                  viewBox="0 0 24 24"
                  width={20}
                  height={20}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M6 6l12 12M6 18L18 6" />
                </svg>
              </button>
            </div>

            <form action={action} className="mt-4 flex flex-col gap-3.5">
              <input type="hidden" name="accountId" value={accountId} />

              <label className="flex flex-col gap-1 text-xs font-medium text-[var(--c-muted)]">
                帳戶
                <select
                  value={accountId}
                  onChange={(event) => setAccountId(event.target.value)}
                  className={fieldClass}
                  required
                >
                  {accounts.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                      {item.symbol ? ` · ${item.symbol}` : ""}
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
                  onChange={(event) => setTwd(event.target.value)}
                  placeholder="例：50000"
                  className={`${fieldClass} text-base tnum`}
                />
              </label>

              {account && (
                <div className="rounded-[var(--r-control)] border border-[var(--c-border)] bg-[var(--c-surface-soft)] px-3.5 py-3 text-xs text-[var(--c-muted)]">
                  <div className="flex justify-between gap-4">
                    <span>現價</span>
                    <span className="text-[var(--c-text)] tnum">
                      {account.last_unit_price
                        ? `${account.native_currency} ${account.last_unit_price}`
                        : "—"}
                    </span>
                  </div>
                  {Number(account.last_fx_rate ?? 1) !== 1 && (
                    <div className="mt-1.5 flex justify-between gap-4">
                      <span>匯率</span>
                      <span className="text-[var(--c-text)] tnum">
                        {account.last_fx_rate}
                      </span>
                    </div>
                  )}
                  <div className="mt-2 flex justify-between gap-4 border-t border-[var(--c-border)] pt-2">
                    <span>預計購入</span>
                    <span className="font-semibold text-[var(--c-text)] tnum">
                      {previewShares > 0
                        ? `${fmtShares(previewShares)} 股`
                        : "—"}
                    </span>
                  </div>
                  {twdNumber > 0 && (
                    <div className="mt-1.5 flex justify-between gap-4 text-[10px]">
                      <span>投入</span>
                      <span className="amt tnum">NT$ {fmtTwd(twdNumber)}</span>
                    </div>
                  )}
                </div>
              )}

              {accountMissingPrice && (
                <p className="rounded-[var(--r-control)] bg-[color-mix(in_srgb,#E0B15F_14%,transparent)] px-3 py-2 text-xs text-[#E0B15F]">
                  此帳戶目前沒有市價，請先到帳戶詳情頁更新價格。
                </p>
              )}
              {state?.error && (
                <p className="rounded-[var(--r-control)] bg-[color-mix(in_srgb,var(--c-down)_14%,transparent)] px-3 py-2 text-xs text-[var(--c-down)]">
                  {state.error}
                </p>
              )}

              <button
                type="submit"
                disabled={
                  pending || !accountId || !(twdNumber > 0) || accountMissingPrice
                }
                className="mt-1 min-h-12 rounded-[var(--r-control)] bg-[var(--c-accent)] px-5 text-sm font-semibold text-[var(--c-btn-strong-text)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending ? "記錄中…" : "確認加碼"}
              </button>

              <p className="text-[10px] leading-relaxed text-[var(--c-faint)]">
                依目前報價估算；自訂成交價、匯率或時間請進入帳戶詳情頁。
              </p>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
