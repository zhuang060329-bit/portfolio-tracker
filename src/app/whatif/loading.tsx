import { AppHeader } from "@/components/AppHeader";

export default function WhatIfLoading() {
  return (
    <div className="min-h-screen bg-[var(--c-page)] text-[var(--c-text)]">
      <AppHeader active={null} />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="mb-4 h-4 w-24 animate-pulse rounded bg-[var(--c-border)]" />
        <div className="h-9 w-40 animate-pulse rounded bg-[var(--c-border)]" />
        <div className="mt-3 h-3 w-96 max-w-full animate-pulse rounded bg-[var(--c-border)]" />
        <section className="mt-6 grid gap-3 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="rounded-md border border-[var(--c-border)] bg-[var(--c-surface)] p-4 shadow-sm"
            >
              <div className="h-3 w-16 animate-pulse rounded bg-[var(--c-border)]" />
              <div className="mt-2 h-7 w-32 animate-pulse rounded bg-[var(--c-border)]" />
              <div className="mt-2 h-3 w-24 animate-pulse rounded bg-[var(--c-border)]" />
            </div>
          ))}
        </section>
        <div className="mt-8 h-6 w-48 animate-pulse rounded bg-[var(--c-border)]" />
        <div className="mt-4 flex flex-col gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-md border border-[var(--c-border)] bg-[var(--c-surface)] p-4 shadow-sm"
            >
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 animate-pulse rounded bg-[var(--c-border)]" />
                <div className="h-4 w-36 animate-pulse rounded bg-[var(--c-border)]" />
                <div className="ml-auto h-5 w-28 animate-pulse rounded bg-[var(--c-border)]" />
              </div>
              <div className="mt-2 h-3 w-24 animate-pulse rounded bg-[var(--c-border)]" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
