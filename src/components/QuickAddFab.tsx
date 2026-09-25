"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { addByAmount, type FormState } from "@/app/accounts/[id]/actions";
import { useActionAnnounce } from "@/components/a11y/use-action-announce";

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
  const [menuOpen, setMenuOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [twd, setTwd] = useState("");
  const [state, action, pending] = useActionState<FormState, FormData>(
    addByAmount,
    undefined,
  );
  // 成功時對話框會關閉，畫面上沒有任何成功訊息可讀，所以補一句。
  useActionAnnounce(state, pending, "加碼已記錄");
  const dialogRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const previousPending = useRef(false);
  const menuId = `quick-create-${useId().replace(/:/g, "")}`;

  useEffect(() => {
    if (previousPending.current && !pending && !state?.error) {
      setQuickAddOpen(false);
      setTwd("");
    }
    previousPending.current = pending;
  }, [pending, state]);

  useEffect(() => {
    if (!quickAddOpen) return;

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
        setQuickAddOpen(false);
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
  }, [quickAddOpen]);

  useEffect(() => {
    if (!menuOpen) return;

    const focusables = () =>
      Array.from(
        menuRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
    focusables()[0]?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setMenuOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      const items = focusables();
      if (items.length === 0) return;
      event.preventDefault();
      const current = items.indexOf(document.activeElement as HTMLElement);
      const delta = event.key === "ArrowDown" ? 1 : -1;
      items[(current + delta + items.length) % items.length]?.focus();
    }

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (
        !menuRef.current?.contains(target) &&
        !triggerRef.current?.contains(target)
      ) {
        setMenuOpen(false);
      }
    }

    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [menuOpen]);

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

  const fieldClass =
    "mt-1 h-11 rounded-[var(--r-control)] border border-[var(--c-border)] bg-[var(--c-surface-soft)] px-3.5 text-sm text-[var(--c-text)] outline-none focus:border-[color-mix(in_srgb,var(--c-accent)_50%,transparent)] focus:shadow-[0_0_0_3px_var(--c-accent-soft)]";

  return (
    <>
      {menuOpen && (
        <div
          ref={menuRef}
          id={menuId}
          role="group"
          aria-label="快速建立"
          className="create-menu-panel fixed bottom-[calc(max(1rem,env(safe-area-inset-bottom))+64px)] right-4 z-40 w-[220px] overflow-hidden rounded-[var(--r-card)] border border-[var(--c-line-strong)] bg-[var(--c-surface)] p-1.5 shadow-[var(--c-shadow)] sm:hidden"
        >
          <button
            type="button"
            disabled={accounts.length === 0}
            onClick={() => {
              setMenuOpen(false);
              setQuickAddOpen(true);
            }}
            className="create-menu-item flex min-h-11 w-full items-center gap-3 rounded-[var(--r-control)] px-3 text-left text-sm font-medium hover:bg-[var(--c-surface-soft)] disabled:cursor-not-allowed disabled:opacity-45"
          >
            <MenuIcon type="add" />
            <span>
              快速加碼
              {accounts.length === 0 && (
                <span className="block text-xs font-normal text-[var(--c-faint)]">
                  先建立可報價帳戶
                </span>
              )}
            </span>
          </button>
          <Link
            href="/accounts/new"
            onClick={() => setMenuOpen(false)}
            className="create-menu-item flex min-h-11 items-center gap-3 rounded-[var(--r-control)] px-3 text-sm font-medium hover:bg-[var(--c-surface-soft)]"
          >
            <MenuIcon type="account" />
            建立帳戶
          </Link>
          <Link
            href="/activity#csv-import"
            onClick={() => setMenuOpen(false)}
            className="create-menu-item flex min-h-11 items-center gap-3 rounded-[var(--r-control)] px-3 text-sm font-medium hover:bg-[var(--c-surface-soft)]"
          >
            <MenuIcon type="import" />
            匯入 CSV
          </Link>
        </div>
      )}

      <button
        ref={triggerRef}
        type="button"
        onClick={() => setMenuOpen((value) => !value)}
        aria-label={menuOpen ? "關閉快速建立選單" : "開啟快速建立選單"}
        aria-expanded={menuOpen}
        aria-controls={menuId}
        className="create-menu-trigger fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-40 grid h-[52px] w-[52px] place-items-center rounded-[var(--r-card)] bg-[var(--c-accent)] text-[var(--c-btn-strong-text)] shadow-[0_8px_22px_rgba(0,0,0,0.28)] hover:brightness-105 sm:hidden"
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

      {quickAddOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 backdrop-blur-[2px] sm:items-center sm:p-5"
          onClick={(event) => {
            if (event.target === event.currentTarget) setQuickAddOpen(false);
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="快速加碼"
            className="safe-bottom max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-[var(--r-card)] border border-[var(--c-line-strong)] bg-[var(--c-surface)] p-4 shadow-[var(--c-shadow)] sm:rounded-[var(--r-card)] sm:p-6"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-[18px] font-semibold tracking-[-0.02em]">
                快速加碼
              </h2>
              <button
                type="button"
                onClick={() => setQuickAddOpen(false)}
                aria-label="關閉"
                className="btn btn-ghost btn-icon"
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
                    <div className="mt-1.5 flex justify-between gap-4 text-xs">
                      <span>投入</span>
                      <span className="amt tnum">NT$ {fmtTwd(twdNumber)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* 改用 --c-warn：原本寫死 #E0B15F 當字色，在淺色主題下對這塊
                  14% 色底只有 1.75:1，等於看不見。結構與下方錯誤訊息一致。 */}
              {accountMissingPrice && (
                <p className="rounded-[var(--r-control)] bg-[color-mix(in_srgb,var(--c-warn)_14%,transparent)] px-3 py-2 text-xs text-[var(--c-warn)]">
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
                className="btn btn-primary btn-lg mt-1"
              >
                {pending ? "記錄中…" : "確認加碼"}
              </button>

              <p className="text-xs leading-relaxed text-[var(--c-faint)]">
                依目前報價估算，不記手續費；要記手續費或自訂成交價、匯率、時間請進入帳戶詳情頁。
              </p>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function MenuIcon({ type }: { type: "add" | "account" | "import" }) {
  const path =
    type === "add"
      ? "M12 5v14M5 12h14"
      : type === "account"
        ? "M4 20v-2a4 4 0 0 1 4-4h4M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M18 8v6M15 11h6"
        : "M12 3v12M7 10l5 5 5-5M5 21h14";
  return (
    <svg
      viewBox="0 0 24 24"
      width={18}
      height={18}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0 text-[var(--c-accent)]"
    >
      <path d={path} />
    </svg>
  );
}
