import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";
import { MobileNavToggle } from "./MobileNavToggle";

type Active =
  | "portfolio"
  | "accounts"
  | "activity"
  | "alerts"
  | "whatif"
  | "settings"
  | null;

/**
 * Midnight Ledger Header。
 * - sticky + 半透明 backdrop-blur
 * - logo：金鑽 ◆ + Newsreader 字體 wordmark
 * - 桌機：5 個 nav（總覽 / 活動 / 提醒 / What-if / 設定）
 * - 手機：漢堡開合（用 MobileNavToggle client component）
 * - 右側：鈴鐺（紅點）/ 主題切換 / 頭像
 *
 * unreadCount 由每個 server page fetch 傳入（保持本元件為純樣式）。
 */
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
    { href: "/activity", label: "活動", key: "activity" },
    { href: "/alerts", label: "提醒", key: "alerts" },
    { href: "/whatif", label: "What-if", key: "whatif" },
    { href: "/settings", label: "設定", key: "settings" },
  ];

  const initials = getInitials(userEmail);

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--c-border)] bg-[color-mix(in_srgb,var(--c-page)_82%,transparent)] backdrop-blur-md backdrop-saturate-150">
      <div className="mx-auto flex h-[62px] max-w-[1200px] items-center gap-7 px-7">
        {/* Brand */}
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5 text-[var(--c-text)]"
          aria-label="StackWorth 首頁"
        >
          <DiamondMark className="text-[var(--c-accent)]" />
          <span className="font-serif text-[21px] font-medium tracking-tight">
            StackWorth
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="ml-2 hidden items-center gap-1 md:flex">
          {navItems.map((it) => (
            <NavLink
              key={it.href}
              href={it.href}
              active={active === it.key}
              label={it.label}
            />
          ))}
        </nav>

        {/* Right cluster */}
        <div className="ml-auto flex h-full items-center gap-2.5">
          {userEmail && (
            <Link
              href="/notifications"
              aria-label={`通知${unreadCount > 0 ? `（${unreadCount} 則未讀）` : ""}`}
              title={`通知${unreadCount > 0 ? `（${unreadCount} 則未讀）` : ""}`}
              className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-[var(--c-muted)] hover:border-[var(--c-border)] hover:bg-[var(--c-surface-soft)] hover:text-[var(--c-text)]"
            >
              <BellIcon />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-[var(--c-accent)] px-1 text-[9px] font-bold text-[var(--c-btn-strong-text)] tabular-nums">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>
          )}

          <ThemeToggle />

          {userEmail && (
            <Link
              href="/settings"
              title={userEmail ?? "帳號"}
              aria-label="帳號設定"
              className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-full border border-[var(--c-line-strong)] bg-[var(--c-accent-soft)] text-[12px] font-bold text-[var(--c-accent)]"
            >
              {initials}
            </Link>
          )}

          {/* 手機漢堡 */}
          <div className="md:hidden">
            <MobileNavToggle items={navItems} active={active} />
          </div>

          {/* 未登入時直接顯示登出表單會 hydrate 錯誤；保險作法：留按鈕但接到登入頁 */}
          {!userEmail && (
            <Link
              href="/login"
              className="rounded-lg border border-[var(--c-line-strong)] bg-[var(--c-surface)] px-3 py-1.5 text-xs font-medium text-[var(--c-text)] hover:bg-[var(--c-surface-soft)]"
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
      className={`rounded-md px-3 py-1.5 text-[13.5px] font-medium transition ${
        active
          ? "bg-[var(--c-accent-soft)] text-[var(--c-accent)] shadow-[inset_0_-2px_0_var(--c-accent)]"
          : "text-[var(--c-muted)] hover:bg-[var(--c-surface-soft)] hover:text-[var(--c-text)]"
      }`}
    >
      {label}
    </Link>
  );
}

function DiamondMark({ className = "" }: { className?: string }) {
  return (
    <svg
      width="15"
      height="15"
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
  // 取前兩個字母，若名稱中含「.」或「_」「-」則拼第一段與第二段首字
  const parts = name.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}
