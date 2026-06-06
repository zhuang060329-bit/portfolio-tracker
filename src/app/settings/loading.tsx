import { AppHeader } from "@/components/AppHeader";

export default function SettingsLoading() {
  return (
    <div className="min-h-screen bg-[var(--c-page)] text-[var(--c-text)]">
      <AppHeader active="settings" />
      <main className="mx-auto max-w-[980px] px-4 pb-32 pt-8 sm:px-6 sm:pt-10">
        <div className="h-9 w-20 animate-pulse rounded bg-[var(--c-surface-soft)]" />
        <div className="mt-2 h-3 w-72 animate-pulse rounded bg-[var(--c-surface-soft)]" />
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-[180px_1fr] md:gap-7">
          <aside className="flex flex-col gap-1">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-9 w-full animate-pulse rounded-lg bg-[var(--c-surface-soft)]"
              />
            ))}
          </aside>
          <div className="flex flex-col gap-4">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-6"
              >
                <div className="h-5 w-32 animate-pulse rounded bg-[var(--c-surface-soft)]" />
                <div className="mt-4 h-16 animate-pulse rounded bg-[var(--c-surface-soft)]" />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
