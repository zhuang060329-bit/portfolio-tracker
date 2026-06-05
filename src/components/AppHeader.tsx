import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";

type Active = "portfolio" | "accounts" | "activity" | null;

export function AppHeader({
  active,
  userEmail,
}: {
  active: Active;
  userEmail?: string | null;
}) {
  return (
    <header className="border-b border-[var(--c-border)] bg-[var(--c-surface-soft)]">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex h-full items-center gap-8">
          <Link
            href="/"
            className="font-serif text-lg font-semibold tracking-tight text-[var(--c-text)]"
          >
            Portfolio Tracker
          </Link>
          <nav className="hidden h-full items-center md:flex">
            <NavItem href="/" active={active === "portfolio"} label="Portfolio" />
            <NavItem
              href="/accounts/new"
              active={active === "accounts"}
              label="Accounts"
            />
            <NavItem
              href="/activity"
              active={active === "activity"}
              label="Activity"
            />
          </nav>
        </div>
        <div className="flex h-full items-center gap-3 text-sm">
          {userEmail && (
            <Link
              href="/settings"
              className="hidden text-[var(--c-muted)] hover:text-[var(--c-text)] sm:inline"
              title="Settings"
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
              Sign out
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
