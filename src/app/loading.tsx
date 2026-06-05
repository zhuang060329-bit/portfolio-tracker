import { AppHeader } from "@/components/AppHeader";

/**
 * 首頁讀取 skeleton。Next.js 在 server-side data fetch 期間會渲染這個。
 * 用 pulse 灰塊模擬主要區塊位置，避免「白屏 → 突然出現」的跳動感。
 */
export default function HomeLoading() {
  return (
    <div className="min-h-screen bg-[var(--c-page)] text-[var(--c-text)]">
      <AppHeader active="portfolio" />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        {/* 總淨資產 hero skeleton */}
        <section className="border-b border-[var(--c-border)] pb-8">
          <div className="h-3 w-24 animate-pulse rounded bg-[var(--c-border)]" />
          <div className="mt-3 h-12 w-64 animate-pulse rounded bg-[var(--c-border)]" />
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
            <div className="h-4 w-28 animate-pulse rounded bg-[var(--c-border)]" />
            <div className="h-4 w-40 animate-pulse rounded bg-[var(--c-border)]" />
            <div className="h-4 w-32 animate-pulse rounded bg-[var(--c-border)]" />
          </div>
        </section>

        {/* 圖表區 skeleton */}
        <section className="mt-8 grid gap-4 lg:grid-cols-2">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="rounded-md border border-[var(--c-border)] bg-[var(--c-surface)] p-5 shadow-sm"
            >
              <div className="h-4 w-32 animate-pulse rounded bg-[var(--c-border)]" />
              <div className="mt-2 h-3 w-48 animate-pulse rounded bg-[var(--c-border)]" />
              <div className="mt-4 h-[260px] animate-pulse rounded bg-[var(--c-border)]/40" />
            </div>
          ))}
        </section>

        {/* 持有資產 skeleton */}
        <section className="mt-8">
          <div className="h-6 w-32 animate-pulse rounded bg-[var(--c-border)]" />
          <div className="mt-6 overflow-hidden rounded-md border border-[var(--c-border)] bg-[var(--c-surface)] shadow-sm">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="flex items-center gap-4 border-b border-[var(--c-border-soft)] px-4 py-4 last:border-b-0"
              >
                <div className="h-4 w-40 animate-pulse rounded bg-[var(--c-border)]" />
                <div className="ml-auto h-4 w-24 animate-pulse rounded bg-[var(--c-border)]" />
                <div className="h-4 w-20 animate-pulse rounded bg-[var(--c-border)]" />
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
