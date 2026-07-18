import Link from "next/link";
import { PrivacyToggle } from "./PrivacyToggle";
import { ThemeToggle } from "./ThemeToggle";

type DemoActive = "overview" | "decisions" | "history" | "scenario" | "report";

export function DemoV1Header({ active }: { active: DemoActive }) {
  const items: { href: string; label: string; key: DemoActive }[] = [
    { href: "/demo", label: "總覽", key: "overview" },
    { href: "/demo/decisions", label: "日誌", key: "decisions" },
    { href: "/demo/history", label: "歷史", key: "history" },
    { href: "/demo/whatif", label: "壓力", key: "scenario" },
    { href: "/demo/report", label: "月報", key: "report" },
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--c-border)] bg-[color-mix(in_srgb,var(--c-page)_92%,transparent)] backdrop-blur-xl">
      <div className="mx-auto flex min-h-[var(--header-h)] max-w-[1200px] flex-wrap items-center gap-2 px-4 py-2 sm:px-6">
        <Link href="/demo" className="font-semibold">StackWorth <span className="ml-1 rounded border border-[var(--c-accent)] px-1.5 py-0.5 text-[9px] text-[var(--c-accent)]">DEMO</span></Link>
        <nav aria-label="Demo 功能" className="order-3 flex w-full gap-1 overflow-x-auto sm:order-none sm:ml-4 sm:w-auto">
          {items.map((item) => <Link key={item.href} href={item.href} aria-current={active === item.key ? "page" : undefined} className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[12px] ${active === item.key ? "bg-[var(--c-accent-soft)] font-semibold text-[var(--c-accent)]" : "text-[var(--c-muted)] hover:text-[var(--c-text)]"}`}>{item.label}</Link>)}
        </nav>
        <div className="ml-auto flex items-center"><PrivacyToggle /><ThemeToggle /></div>
      </div>
    </header>
  );
}
