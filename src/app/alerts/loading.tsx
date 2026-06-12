import { AppHeader } from "@/components/AppHeader";

const sk = "sk rounded";
const card =
  "rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-5 shadow-[var(--c-shadow)] sm:px-6";

export default function AlertsLoading() {
  return (
    <div className="min-h-screen bg-[var(--c-page)] text-[var(--c-text)]">
      <AppHeader active="alerts" />
      <main className="mx-auto max-w-[820px] px-7 py-9 pb-28">
        <div className={`mb-4 h-4 w-20 ${sk}`} />
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className={`h-8 w-20 ${sk}`} />
            <div className={`mt-2 h-3 w-72 ${sk}`} />
          </div>
          <div className={`h-10 w-12 ${sk}`} />
        </div>

        {/* 新增面板 */}
        <section className={`mt-6 ${card}`}>
          <div className={`h-5 w-24 ${sk}`} />
          <div className="mt-[18px] grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className={`h-24 rounded-xl ${sk} opacity-60`} />
            ))}
          </div>
          <div className="mt-[18px] grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div className={`h-[42px] rounded-[10px] ${sk}`} />
            <div className={`h-[42px] rounded-[10px] ${sk}`} />
          </div>
          <div className={`mt-4 h-12 rounded-[11px] ${sk} opacity-60`} />
          <div className={`mt-[18px] h-10 w-28 rounded-[10px] ${sk}`} />
        </section>

        {/* 列表 */}
        <div className="mt-6 flex flex-col gap-2.5">
          <div className={`h-4 w-24 ${sk}`} />
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="grid grid-cols-[auto_1fr_auto] items-center gap-[15px] rounded-[14px] border border-[var(--c-border)] bg-[var(--c-surface)] p-4 shadow-[var(--c-shadow)] sm:px-[18px]"
            >
              <div className={`h-10 w-10 rounded-[11px] ${sk}`} />
              <div>
                <div className={`h-4 w-44 ${sk}`} />
                <div className={`mt-2.5 h-1.5 w-full ${sk}`} />
                <div className={`mt-2 h-3 w-32 ${sk}`} />
              </div>
              <div className="flex items-center gap-2">
                <div className={`h-6 w-[42px] rounded-full ${sk}`} />
                <div className={`h-[34px] w-[34px] rounded-[9px] ${sk}`} />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
