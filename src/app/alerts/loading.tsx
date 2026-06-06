import { AppHeader } from "@/components/AppHeader";

export default function AlertsLoading() {
  return (
    <div className="min-h-screen bg-[var(--c-page)] text-[var(--c-text)]">
      <AppHeader active={null} />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="mb-4 h-4 w-24 animate-pulse rounded bg-[var(--c-border)]" />
        <div className="h-8 w-20 animate-pulse rounded bg-[var(--c-border)]" />
        <div className="mt-3 h-3 w-80 animate-pulse rounded bg-[var(--c-border)]" />
        <section className="mt-6 rounded-md border border-[var(--c-border)] bg-[var(--c-surface)] p-5 shadow-sm">
          <div className="h-5 w-24 animate-pulse rounded bg-[var(--c-border)]" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="h-16 animate-pulse rounded bg-[var(--c-border)]/40" />
            <div className="h-16 animate-pulse rounded bg-[var(--c-border)]/40" />
            <div className="h-16 animate-pulse rounded bg-[var(--c-border)]/40" />
            <div className="h-16 animate-pulse rounded bg-[var(--c-border)]/40" />
          </div>
          <div className="mt-4 h-10 w-28 animate-pulse rounded bg-[var(--c-border)]" />
        </section>
        <section className="mt-6 rounded-md border border-[var(--c-border)] bg-[var(--c-surface)] p-5 shadow-sm">
          <div className="h-5 w-24 animate-pulse rounded bg-[var(--c-border)]" />
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="mt-3 flex items-center gap-4 border-t border-[var(--c-border-soft)] py-3 first:border-t-0 first:mt-4"
            >
              <div className="h-4 w-44 animate-pulse rounded bg-[var(--c-border)]" />
              <div className="ml-auto h-7 w-16 animate-pulse rounded bg-[var(--c-border)]" />
              <div className="h-7 w-16 animate-pulse rounded bg-[var(--c-border)]" />
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
