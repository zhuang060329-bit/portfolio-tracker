import { AppHeader } from "@/components/AppHeader";

// 骨架照 page.tsx 的地塊排：頁首、左側區段清單、右側單一帳本內的分節。
// .sk 是斜線填紋的空地塊，已自帶掃光與 reduced-motion 處理。
export default function SettingsLoading() {
  return (
    <div className="min-h-dvh bg-[var(--c-page)] text-[var(--c-text)]">
      <AppHeader active="settings" authPending />
      <main id="main" tabIndex={-1} className="mx-auto max-w-[1200px] px-4 py-8 pb-32 sm:px-6 sm:py-10 lg:px-8">
        <header className="mb-8 border-b border-[var(--c-line-strong)] pb-5">
          <div className="sk h-3 w-20" />
          <div className="sk mt-3 h-7 w-20" />
          <div className="sk mt-2.5 h-3 w-72" />
        </header>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[180px_1fr] md:gap-7">
          <aside className="flex flex-row flex-wrap gap-1.5 md:flex-col md:gap-1">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="sk h-11 w-24 md:w-full" />
            ))}
          </aside>
          <div className="border border-[var(--c-border)] bg-[var(--c-surface)] p-5 sm:p-7">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="mt-10 border-t border-[var(--c-line-strong)] pt-6 first:mt-0 first:border-t-0 first:pt-0"
              >
                <div className="sk h-5 w-32" />
                <div className="sk mt-2 h-3 w-56" />
                <div className="sk mt-5 h-11" />
                <div className="sk mt-3 h-11" />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
