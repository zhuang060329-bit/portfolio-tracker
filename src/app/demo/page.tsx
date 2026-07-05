import type { Metadata } from "next";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { buildDashboardData } from "@/lib/dashboard-data";
import { buildDemoInputs } from "@/lib/demo-data";
import { todayTaipei } from "@/lib/dates";
import { PrivacyToggle } from "@/components/PrivacyToggle";
import { ThemeToggle } from "@/components/ThemeToggle";

// 公開展示頁：免登入（proxy 白名單）、不碰 Supabase。
// 資料由 demo-data 生成（確定性偽隨機），走與真實總覽完全相同的
// buildDashboardData 計算管線 — XIRR / TWR / Sharpe / 回撤都是算出來的。
// 互動降級：無刷新鈕、無新增帳戶、持倉不可點（那些路徑需要登入）。

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
      <header className="sticky top-0 z-40 border-b border-[var(--c-border)] bg-[color-mix(in_srgb,var(--c-page)_82%,transparent)] backdrop-blur-md backdrop-saturate-150">
        <div className="mx-auto flex h-[62px] max-w-[1200px] items-center gap-3.5 px-7">
          <span className="flex shrink-0 items-center gap-2.5">
            <svg
              width="15"
              height="15"
              viewBox="0 0 16 16"
              fill="currentColor"
              className="text-[var(--c-accent)]"
              aria-hidden="true"
            >
              <path d="M8 1 L15 8 L8 15 L1 8 Z" />
            </svg>
            <span className="font-serif text-[21px] font-medium tracking-tight">
              StackWorth
            </span>
          </span>
          <span className="rounded-full border border-[var(--c-accent)] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--c-accent)]">
            Demo
          </span>
          <span className="ml-auto flex items-center gap-1">
            <PrivacyToggle />
            <ThemeToggle />
            <a
              href="https://github.com/zhuang060329-bit/portfolio-tracker"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-1 rounded-[var(--r-control)] border border-[var(--c-border)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--c-muted)] transition-colors hover:border-[var(--c-line-strong)] hover:text-[var(--c-text)]"
            >
              GitHub
            </a>
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] px-7 py-9 pb-28">
        <p className="mb-2 px-1 text-[12.5px] leading-relaxed text-[var(--c-muted)]">
          展示資料由固定種子生成，非真實持倉；所有指標（XIRR、TWR、Sharpe、回撤）
          都經由與正式版相同的計算管線得出。
          <span className="mt-0.5 block text-[var(--c-faint)]">
            Generated demo data, not real holdings — every metric is computed
            by the same pipeline as the production dashboard.
          </span>
        </p>
        <DashboardClient data={dashboard} demo />
      </main>
    </div>
  );
}
