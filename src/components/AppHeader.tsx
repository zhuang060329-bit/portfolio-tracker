import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";
import { PrivacyToggle } from "./PrivacyToggle";
import { MobileNavToggle } from "./MobileNavToggle";

type Active =
  | "portfolio"
  | "accounts"
  | "activity"
  | "alerts"
  | "whatif"
  | "settings"
  | null;

export function AppHeader({
  active,
  userEmail,
  unreadCount = 0,
}: {
  active: Active;
  userEmail?: string | null;
  unreadCount?: number;
}) {
  const navItems: { href: string; label: string; key: Active }[] = [
    { href: "/", label: "總覽", key: "portfolio" },
    { href: "/accounts", label: "帳戶", key: "accounts" },
    { href: "/activity", label: "活動", key: "activity" },
    { href: "/alerts", label: "提醒", key: "alerts" },
    { href: "/whatif", label: "推演", key: "whatif" },
    { href: "/settings", label: "設定", key: "settings" },
  ];

  const initials = getInitials(userEmail);

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--c-border)] bg-[color-mix(in_srgb,var(--c-page)_90%,transparent)] backdrop-blur-xl">
      <div className="mx-auto flex h-[var(--header-h)] max-w-[1200px] items-center gap-4 px-4 sm:px-6 lg:px-7">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 text-[var(--c-text)]"
          aria-label="StackWorth 首頁"
        >
          <DiamondMark className="text-[var(--c-accent)]" />
          <span className="text-[17px] font-semibold tracking-[-0.025em] sm:text-[18px]">
            StackWorth
          </span>
        </Link>

        <nav className="ml-2 hidden h-full items-center gap-1 md:flex" aria-label="主要導覽">
          {navItems.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              active={active === item.key}
              label={item.label}
            />
          ))}
        </nav>

        <div className="ml-auto flex h-full items-center gap-1 sm:gap-1.5">
          {userEmail && (
            <Link
              href="/notifications"
              aria-label={`通知${unreadCount > 0 ? `，${unreadCount} 則未讀` : ""}`}
              title="通知"
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-[var(--r-control)] text-[var(--c-muted)] hover:bg-[var(--c-surface-soft)] hover:text-[var(--c-text)]"
            >
              <BellIcon />
              {unreadCount > 0 && (
                <span className="absolute right-1 top-1 flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-[var(--c-accent)] px-1 text-[8px] font-bold text-[var(--c-btn-strong-text)] tnum">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>
          )}

          <PrivacyToggle />
          <div className="hidden md:block">
            <ThemeToggle />
          </div>

          {userEmail && (
            <Link
              href="/settings"
              title={userEmail}
              aria-label="帳號設定"
              className="hidden h-8 w-8 items-center justify-center rounded-full border border-[var(--c-border)] bg-[var(--c-surface)] text-[11px] font-semibold text-[var(--c-muted)] sm:inline-flex"
            >
              {initials}
            </Link>
          )}

          <div className="md:hidden">
            <MobileNavToggle
              items={navItems}
              active={active}
              signedIn={Boolean(userEmail)}
            />
          </div>

          {!userEmail && (
            <Link
              href="/login"
              className="rounded-[var(--r-control)] border border-[var(--c-line-strong)] bg-[var(--c-surface)] px-3 py-2 text-xs font-medium text-[var(--c-text)] hover:bg-[var(--c-surface-soft)]"
            >
              登入
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

function NavLink({
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
      aria-current={active ? "page" : undefined}
      className={`relative flex h-full items-center px-2.5 text-[13px] font-medium ${
        active
          ? "text-[var(--c-text)] after:absolute after:inset-x-2.5 after:bottom-0 after:h-[2px] after:bg-[var(--c-accent)]"
          : "text-[var(--c-muted)] hover:text-[var(--c-text)]"
      }`}
    >
      {label}
    </Link>
  );
}

function DiamondMark({ className = "" }: { className?: string }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M8 1 L15 8 L8 15 L1 8 Z" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function getInitials(email?: string | null): string {
  if (!email) return "··";
  const at = email.indexOf("@");
  const name = at > 0 ? email.slice(0, at) : email;
  const parts = name.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}
