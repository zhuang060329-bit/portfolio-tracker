"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { ThemeToggle } from "./ThemeToggle";

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

export function MobileNavToggle({
  items,
  active,
  signedIn,
}: {
  items: Item[];
  active: Item["key"];
  signedIn: boolean;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const panelId = `mobile-nav-${useId().replace(/:/g, "")}`;

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusables = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
    focusables()[0]?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;

      const itemsInPanel = focusables();
      if (itemsInPanel.length === 0) return;
      const first = itemsInPanel[0];
      const last = itemsInPanel[itemsInPanel.length - 1];
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
      buttonRef.current?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? "關閉導覽" : "開啟導覽"}
        aria-expanded={open}
        aria-controls={panelId}
        className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--r-control)] text-[var(--c-muted)] hover:bg-[var(--c-surface-soft)] hover:text-[var(--c-text)]"
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
            <path d="M3 7h18M3 12h18M3 17h18" />
          )}
        </svg>
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="關閉導覽"
            onClick={() => setOpen(false)}
            className="fixed inset-0 top-[var(--header-h)] z-30 bg-black/45 backdrop-blur-[2px] md:hidden"
          />
          <nav
            ref={panelRef}
            id={panelId}
            className="safe-bottom fixed left-0 right-0 top-[var(--header-h)] z-40 flex max-h-[calc(100dvh-var(--header-h))] flex-col overflow-y-auto border-b border-[var(--c-border)] bg-[var(--c-page)] px-4 pb-4 pt-3 shadow-[var(--c-shadow)] md:hidden"
            aria-label="主要導覽"
          >
            <div className="grid grid-cols-2 gap-1.5">
              {items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active === item.key ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className={`flex min-h-12 items-center rounded-[var(--r-control)] px-3.5 text-[14px] font-medium ${
                    active === item.key
                      ? "bg-[var(--c-accent-soft)] text-[var(--c-accent)]"
                      : "border border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-muted)] hover:text-[var(--c-text)]"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-[var(--c-border)] pt-3">
              <span className="text-[12px] text-[var(--c-muted)]">顯示模式</span>
              <ThemeToggle />
            </div>

            {signedIn && (
              <form action="/auth/signout" method="post" className="mt-3">
                <button
                  type="submit"
                  className="min-h-11 w-full rounded-[var(--r-control)] border border-[var(--c-border)] bg-[var(--c-surface)] px-3 text-sm font-medium text-[var(--c-text)]"
                >
                  登出
                </button>
              </form>
            )}
          </nav>
        </>
      )}
    </>
  );
}
