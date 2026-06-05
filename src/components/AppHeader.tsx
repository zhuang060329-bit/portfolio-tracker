import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";

type Active = "portfolio" | "accounts" | "activity" | null;

export function AppHeader({
  active,
  userEmail,
  unreadCount = 0,
}: {
  active: Active;
  userEmail?: string | null;
  unreadCount?: number;
}) {
  return (
    <header className="border-b border-[var(--c-border)] bg-[var(--c-surface-soft)]">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex h-full items-center gap-8">
          <Link
            href="/"
            className="font-serif text-lg font-semibold tracking-tight text-[var(--c-text)]"
          >
            StackWorth
          </Link>
          <nav className="hidden h-full items-center md:flex">
            <NavItem href="/" active={active === "portfolio"} label="總覽" />
            <NavItem
              href="/accounts/new"
              active={active === "accounts"}
              label="帳戶"
            />
            <NavItem
              href="/activity"
              active={active === "activity"}
              label="紀錄"
            />
          </nav>
        </div>
        <div className="flex h-full items-center gap-3 text-sm">
          {userEmail && (
            <Link
              href="/notifications"
              className="relative inline-flex h-8 w-8 items-center justify-center rounded-sm text-[var(--c-muted)] hover:bg-[var(--c-surface)] hover:text-[var(--c-text)]"
              title={`通知${unreadCount > 0 ? `（${unreadCount} 則未讀）` : ""}`}
              aria-label="通知"
            >
              <BellIcon />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[var(--c-accent)] px-1 text-[10px] font-semibold tabular-nums text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>
          )}
          {userEmail && (
            <Link
              href="/settings"
              className="hidden text-[var(--c-muted)] hover:text-[var(--c-text)] sm:inline"
              title="設定"
            >
              {userEmail}
            </Link>
          )}
          <ThemeToggle />
          <form action="/auth/signout" method="post" className="flex items-center">
            <button
              type="submit"
              className="rounded-sm border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-1.5 text-xs font-medium text-[var(--c-text)] hover:bg-[var(--c-page)]"
            >
              登出
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

function NavItem({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={`flex h-full items-center border-b-2 px-3 text-sm transition-colors ${
        active
          ? "border-[var(--c-accent)] font-medium text-[var(--c-text)]"
          : "border-transparent text-[var(--c-muted)] hover:text-[var(--c-text)]"
      }`}
    >
      {label}
    </Link>
  );
}

function BellIcon() {
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
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}
