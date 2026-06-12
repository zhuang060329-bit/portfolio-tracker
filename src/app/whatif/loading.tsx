import { AppHeader } from "@/components/AppHeader";

const sk = "sk rounded";
const card =
  "rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-5 shadow-[var(--c-shadow)] sm:px-6";

export default function WhatIfLoading() {
  return (
    <div className="min-h-screen bg-[var(--c-page)] text-[var(--c-text)]">
      <AppHeader active="whatif" />
      <main className="mx-auto max-w-[1200px] px-7 py-9 pb-28">
        <div className={`mb-4 h-4 w-20 ${sk}`} />
        <div className={`h-9 w-40 ${sk}`} />
        <div className={`mt-2 h-3 w-80 max-w-full ${sk}`} />

        {/* tabs */}
        <div className={`mt-5 h-11 w-56 rounded-[11px] ${sk}`} />

        {/* 雙欄：控制 + 結果 */}
        <div className="mt-5 grid grid-cols-1 items-start gap-[18px] min-[880px]:grid-cols-[350px_1fr]">
          <section className={card}>
            <div className={`h-5 w-24 ${sk}`} />
            <div className={`mt-2 h-3 w-40 ${sk}`} />
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="mt-5">
                <div className="flex justify-between">
                  <div className={`h-3 w-24 ${sk}`} />
                  <div className={`h-3 w-16 ${sk}`} />
                </div>
                <div className={`mt-2.5 h-1.5 w-full ${sk}`} />
              </div>
            ))}
          </section>

          <section className={card}>
            <div className={`h-3 w-28 ${sk}`} />
            <div className={`mt-2 h-11 w-56 ${sk}`} />
            <div className={`mt-3 h-3 w-64 ${sk}`} />
            <div className={`mt-5 h-[280px] ${sk} opacity-50`} />
            <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[var(--c-border)] bg-[var(--c-border)] sm:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="bg-[var(--c-surface)] px-4 py-3.5">
                  <div className={`h-3 w-16 ${sk}`} />
                  <div className={`mt-2 h-5 w-20 ${sk}`} />
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
