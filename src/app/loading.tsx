import { AppHeader } from "@/components/AppHeader";

// 首頁讀取 skeleton：對齊 Midnight Ledger 儀表板版面，避免載入跳動。
const sk = "sk rounded";
const card =
  "rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-5 shadow-[var(--c-shadow)] sm:px-6";

export default function HomeLoading() {
  return (
    <div className="min-h-screen bg-[var(--c-page)] text-[var(--c-text)]">
      <AppHeader active="portfolio" />
      <main className="mx-auto max-w-[980px] px-7 py-9 pb-28">
        <div className="flex flex-col gap-5">
          {/* Hero */}
          <section className="px-1 pt-4 sm:pt-7">
            <div className={`h-3 w-32 ${sk}`} />
            <div className={`mt-3 h-14 w-72 ${sk}`} />
            <div className="mt-4 flex gap-3">
              <div className={`h-8 w-40 rounded-full ${sk}`} />
              <div className={`h-8 w-28 rounded-full ${sk}`} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-[var(--c-border)] bg-[var(--c-border)] sm:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="bg-[var(--c-surface)] px-4 py-4">
                  <div className={`h-3 w-16 ${sk}`} />
                  <div className={`mt-2 h-6 w-20 ${sk}`} />
                </div>
              ))}
            </div>
          </section>

          {/* 趨勢卡 */}
          <section className={card}>
            <div className={`h-5 w-32 ${sk}`} />
            <div className={`mt-2 h-3 w-48 ${sk}`} />
            <div className={`mt-4 h-[300px] ${sk} opacity-50`} />
          </section>

          {/* 兩欄 */}
          <div className="grid grid-cols-1 gap-5 min-[920px]:grid-cols-2">
            {[0, 1].map((i) => (
              <section key={i} className={card}>
                <div className={`h-5 w-28 ${sk}`} />
                <div className={`mt-4 h-[188px] ${sk} opacity-50`} />
              </section>
            ))}
          </div>

          {/* 持有資產 */}
          <section>
            <div className={`h-7 w-32 ${sk}`} />
            <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] shadow-[var(--c-shadow)]">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 border-b border-[var(--c-border)] px-[18px] py-4 last:border-b-0"
                >
                  <div className={`h-4 w-40 ${sk}`} />
                  <div className={`ml-auto h-4 w-24 ${sk}`} />
                  <div className={`h-4 w-16 ${sk}`} />
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
