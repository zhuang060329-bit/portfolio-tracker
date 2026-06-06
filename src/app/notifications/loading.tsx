import { AppHeader } from "@/components/AppHeader";

export default function NotificationsLoading() {
  return (
    <div className="min-h-screen bg-[var(--c-page)] text-[var(--c-text)]">
      <AppHeader active={null} />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="mb-4 h-4 w-24 animate-pulse rounded bg-[var(--c-border)]" />
        <div className="h-8 w-20 animate-pulse rounded bg-[var(--c-border)]" />
        <div className="mt-3 h-3 w-60 animate-pulse rounded bg-[var(--c-border)]" />
        <div className="mt-6 flex flex-col gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-md border border-[var(--c-border)] bg-[var(--c-surface)] p-4 shadow-sm"
            >
              <div className="flex items-center gap-2">
                <div className="h-4 w-16 animate-pulse rounded bg-[var(--c-border)]" />
                <div className="h-4 w-40 animate-pulse rounded bg-[var(--c-border)]" />
              </div>
              <div className="mt-2 h-3 w-72 animate-pulse rounded bg-[var(--c-border)]" />
              <div className="mt-2 h-3 w-24 animate-pulse rounded bg-[var(--c-border)]" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
