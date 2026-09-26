import { AppHeader } from "@/components/AppHeader";

// 骨架照 page.tsx 的地塊排：返回連結、頁首、通知帳本。
// .sk 是斜線填紋的空地塊，已自帶掃光與 reduced-motion 處理。
export default function NotificationsLoading() {
  return (
    <div className="min-h-dvh bg-[var(--c-page)] text-[var(--c-text)]">
      <AppHeader active={null} authPending />
      <main id="main" tabIndex={-1} className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="sk h-4 w-20" />
        <header className="mt-4 border-b border-[var(--c-line-strong)] pb-5">
          <div className="sk h-3 w-20" />
          <div className="sk mt-3 h-7 w-20" />
          <div className="sk mt-2.5 h-3 w-60" />
        </header>
        <div className="mt-6 border border-[var(--c-border)] bg-[var(--c-surface)]">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="border-t border-[var(--c-border-soft)] px-5 py-4 first:border-t-0">
              <div className="flex items-center gap-2">
                <div className="sk h-5 w-16" />
                <div className="sk h-4 w-40" />
              </div>
              <div className="sk mt-2 h-3 w-72" />
              <div className="sk mt-2 h-3 w-28" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
