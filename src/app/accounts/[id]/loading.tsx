import { AppHeader } from "@/components/AppHeader";

export default function AccountDetailLoading() {
  return (
    <div className="min-h-screen bg-[var(--c-page)] text-[var(--c-text)]">
      <AppHeader active="accounts" />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="mb-4 h-4 w-24 animate-pulse rounded bg-[var(--c-border)]" />
        <header className="border-b border-[var(--c-border)] pb-6">
          <div className="h-3 w-20 animate-pulse rounded bg-[var(--c-border)]" />
          <div className="mt-3 h-9 w-64 animate-pulse rounded bg-[var(--c-border)]" />
          <div className="mt-4 h-10 w-48 animate-pulse rounded bg-[var(--c-border)]" />
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
            <div className="h-4 w-24 animate-pulse rounded bg-[var(--c-border)]" />
            <div className="h-4 w-32 animate-pulse rounded bg-[var(--c-border)]" />
            <div className="h-4 w-24 animate-pulse rounded bg-[var(--c-border)]" />
          </div>
        </header>
        <section className="mt-6 rounded-[var(--r-card)] border border-[var(--c-border)] bg-[var(--c-surface)] p-5 shadow-[var(--c-shadow)]">
          <div className="h-4 w-20 animate-pulse rounded bg-[var(--c-border)]" />
          <div className="mt-4 h-[260px] animate-pulse rounded bg-[var(--c-border)]/40" />
        </section>
        <section className="mt-6">
          <div className="h-4 w-16 animate-pulse rounded bg-[var(--c-border)]" />
          <div className="mt-3 h-10 w-40 animate-pulse rounded bg-[var(--c-border)]" />
        </section>
      </main>
    </div>
  );
}
