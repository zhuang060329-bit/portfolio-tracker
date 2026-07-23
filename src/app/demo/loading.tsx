import { DemoV1Header } from "@/components/DemoV1Header";

const skeleton = "sk rounded-[4px]";
const panel =
  "overflow-hidden rounded-[var(--r-card)] border border-[var(--c-border)] bg-[var(--c-surface)] p-5 sm:p-6";

// Demo 區段的載入骨架。刻意渲染 DemoV1Header（而非根 loading.tsx 的已登入版
// AppHeader），避免公開訪客在載入瞬間閃到「登入」導覽再跳成 DEMO 版。
export default function DemoLoading() {
  return (
    <div className="min-h-screen bg-[var(--c-page)] text-[var(--c-text)]">
      <DemoV1Header active="overview" />
      <main className="mx-auto max-w-[1200px] px-4 pb-24 pt-5 sm:px-6 sm:pt-7 lg:px-7 lg:pt-8">
        <div className={`mb-3 h-3 w-[min(80vw,420px)] ${skeleton}`} />
        <div className="flex flex-col gap-5">
          <section className="border-b border-[var(--c-border)] pb-7 pt-4 sm:pb-8 sm:pt-7">
            <div className={`h-3 w-20 ${skeleton}`} />
            <div className={`mt-3 h-14 w-[min(72vw,360px)] ${skeleton}`} />
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:gap-4">
              <div className={`h-4 w-44 ${skeleton}`} />
              <div className={`h-4 w-36 ${skeleton}`} />
            </div>
          </section>

          <section className="overflow-hidden rounded-[var(--r-card)] border border-[var(--c-border)] bg-[var(--c-border)]">
            <div className="grid grid-cols-2 gap-px sm:grid-cols-4">
              {[0, 1, 2, 3].map((index) => (
                <div
                  key={index}
                  className="bg-[var(--c-surface)] px-4 py-4 sm:px-5 sm:py-[18px]"
                >
                  <div className={`h-3 w-16 ${skeleton}`} />
                  <div className={`mt-2 h-6 w-24 ${skeleton}`} />
                  <div className={`mt-2 h-3 w-20 ${skeleton}`} />
                </div>
              ))}
            </div>
          </section>

          <section className={panel}>
            <div className={`h-5 w-28 ${skeleton}`} />
            <div className={`mt-2 h-3 w-48 ${skeleton}`} />
            <div className={`mt-4 h-[280px] ${skeleton} opacity-50`} />
          </section>
        </div>
      </main>
    </div>
  );
}
