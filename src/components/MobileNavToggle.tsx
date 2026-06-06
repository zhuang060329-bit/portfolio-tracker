"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Item = {
  href: string;
  label: string;
  key:
    | "portfolio"
    | "accounts"
    | "activity"
    | "alerts"
    | "whatif"
    | "settings"
    | null;
};

/**
 * 手機漢堡按鈕 + 下拉 nav。
 * 抽成 client component，AppHeader 可保持 server 渲染。
 * Esc / 點 backdrop / 點 nav 連結都會關閉。
 */
export function MobileNavToggle({
  items,
  active,
}: {
  items: Item[];
  active: Item["key"];
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="開啟導覽"
        aria-expanded={open}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--c-muted)] hover:bg-[var(--c-surface-soft)] hover:text-[var(--c-text)]"
      >
        <svg
          width="19"
          height="19"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          aria-hidden="true"
        >
          {open ? (
            <path d="M6 6l12 12M6 18L18 6" />
          ) : (
            <>
              <path d="M3 6h18M3 12h18M3 18h18" />
            </>
          )}
        </svg>
      </button>

      {open && (
        <>
          {/* backdrop */}
          <button
            type="button"
            aria-label="關閉導覽"
            onClick={() => setOpen(false)}
            className="fixed inset-0 top-[62px] z-30 bg-black/40 md:hidden"
          />
          {/* sheet */}
          <nav
            className="fixed left-0 right-0 top-[62px] z-40 flex flex-col gap-0.5 border-b border-[var(--c-border)] bg-[var(--c-page)] px-5 py-3 md:hidden"
            aria-label="主要導覽"
          >
            {items.map((it) => (
              <Link
                key={it.href}
                href={it.href}
                onClick={() => setOpen(false)}
                className={`rounded-md px-3 py-2.5 text-[15px] font-medium ${
                  active === it.key
                    ? "bg-[var(--c-surface-soft)] text-[var(--c-text)]"
                    : "text-[var(--c-muted)] hover:bg-[var(--c-surface-soft)] hover:text-[var(--c-text)]"
                }`}
              >
                {it.label}
              </Link>
            ))}
            <form action="/auth/signout" method="post" className="mt-2">
              <button
                type="submit"
                className="w-full rounded-md border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-2 text-sm font-medium text-[var(--c-text)]"
              >
                登出
              </button>
            </form>
          </nav>
        </>
      )}
    </>
  );
}
