import type { Metadata } from "next";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { buildDashboardData } from "@/lib/dashboard-data";
import { buildDemoInputs } from "@/lib/demo-data";
import { todayTaipei } from "@/lib/dates";
import { PrivacyToggle } from "@/components/PrivacyToggle";
import { ThemeToggle } from "@/components/ThemeToggle";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "StackWorth — Demo",
  description:
    "Interactive demo of StackWorth, a personal portfolio tracker. Generated data, real computation pipeline.",
};

export default function DemoPage() {
  const today = todayTaipei();
  const dashboard = buildDashboardData(buildDemoInputs(today));

  return (
    <div className="min-h-screen bg-[var(--c-page)] text-[var(--c-text)]">
      <header className="sticky top-0 z-40 border-b border-[var(--c-border)] bg-[color-mix(in_srgb,var(--c-page)_90%,transparent)] backdrop-blur-xl">
        <div className="mx-auto flex h-[var(--header-h)] max-w-[1200px] items-center gap-2.5 px-4 sm:px-6 lg:px-7">
          <span className="flex shrink-0 items-center gap-2">
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="currentColor"
              className="text-[var(--c-accent)]"
              aria-hidden="true"
            >
              <path d="M8 1 L15 8 L8 15 L1 8 Z" />
            </svg>
            <span className="text-[17px] font-semibold tracking-[-0.025em] sm:text-[18px]">
              StackWorth
            </span>
          </span>
          <span className="rounded border border-[var(--c-accent)] px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.06em] text-[var(--c-accent)]">
            DEMO
          </span>
          <span className="ml-auto flex items-center gap-0.5 sm:gap-1">
            <PrivacyToggle />
            <ThemeToggle />
            <a
              href="https://github.com/zhuang060329-bit/portfolio-tracker"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-0.5 hidden min-h-9 items-center rounded-[var(--r-control)] border border-[var(--c-border)] px-3 text-[11px] font-medium text-[var(--c-muted)] hover:border-[var(--c-line-strong)] hover:text-[var(--c-text)] sm:inline-flex"
            >
              GitHub
            </a>
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] px-4 pb-24 pt-5 sm:px-6 sm:pt-7 lg:px-7 lg:pt-8">
        <p className="mb-3 max-w-2xl text-[11px] leading-relaxed text-[var(--c-muted)] sm:text-[12px]">
          展示資料由固定種子生成，並非真實持倉；XIRR、TWR、Sharpe 與回撤皆使用正式版相同的計算管線。
        </p>
        <DashboardClient data={dashboard} demo />
      </main>
    </div>
  );
}
