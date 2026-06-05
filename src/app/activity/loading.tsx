import { AppHeader } from "@/components/AppHeader";

export default function ActivityLoading() {
  return (
    <div className="min-h-screen bg-[var(--c-page)] text-[var(--c-text)]">
      <AppHeader active="activity" />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="h-8 w-32 animate-pulse rounded bg-[var(--c-border)]" />
        <div className="mt-3 h-3 w-72 animate-pulse rounded bg-[var(--c-border)]" />
        <div className="mt-6 rounded-md border border-[var(--c-border)] bg-[var(--c-surface)] p-4 shadow-sm">
          <div className="h-3 w-16 animate-pulse rounded bg-[var(--c-border)]" />
          <div className="mt-2 h-7 w-20 animate-pulse rounded bg-[var(--c-border)]" />
        </div>
        <div className="mt-6 overflow-hidden rounded-md border border-[var(--c-border)] bg-[var(--c-surface)] shadow-sm">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-b border-[var(--c-border-soft)] px-4 py-3 last:border-b-0"
            >
              <div className="h-3 w-28 animate-pulse rounded bg-[var(--c-border)]" />
              <div className="h-3 w-32 animate-pulse rounded bg-[var(--c-border)]" />
              <div className="h-3 w-16 animate-pulse rounded bg-[var(--c-border)]" />
              <div className="ml-auto h-3 w-20 animate-pulse rounded bg-[var(--c-border)]" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
