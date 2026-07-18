import { DemoV1Header } from "@/components/DemoV1Header";
import { todayTaipei } from "@/lib/dates";
import { buildDemoV1Data } from "@/lib/demo-v1-data";

const typeLabel: Record<string, string> = {
  add: "加碼",
  hold: "續抱",
  avoid: "不採取",
};

export default function DemoDecisionsPage() {
  const today = todayTaipei();
  const data = buildDemoV1Data(today);
  return (
    <div className="min-h-screen bg-[var(--c-page)] text-[var(--c-text)]">
      <DemoV1Header active="decisions" />
      <main className="mx-auto max-w-[880px] px-4 pb-24 pt-8 sm:px-6">
        <h1 className="font-serif text-3xl font-medium">決策日誌 Demo</h1>
        <p className="mt-1.5 text-[13px] text-[var(--c-muted)]">固定假資料展示追蹤中、到期與已完成檢討三種狀態。</p>
        <section className="mt-5 overflow-hidden rounded-[var(--r-card)] border border-[var(--c-border)] bg-[var(--c-surface)]">
          {data.decisions.map((decision, index) => {
            const due = decision.status === "open" && decision.reviewDate <= today;
            return (
              <article key={decision.id} className={`p-5 ${index > 0 ? "border-t border-[var(--c-border)]" : ""}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-[var(--c-accent-soft)] px-2 py-1 text-[11px] font-semibold text-[var(--c-accent)]">{typeLabel[decision.decisionType] ?? decision.decisionType}</span>
                  <h2 className="text-[15px] font-semibold">{decision.assetName}</h2>
                  <span className="ml-auto text-[11.5px] text-[var(--c-faint)] tnum">{decision.decisionDate}</span>
                </div>
                <p className="mt-2 text-[13px] leading-6 text-[var(--c-muted)]">{decision.thesis}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11.5px]">
                  <span>檢討日 {decision.reviewDate}</span>
                  <span className={`rounded-full px-2 py-0.5 font-semibold ${decision.status === "reviewed" ? "bg-[color-mix(in_srgb,var(--c-up)_12%,transparent)] text-[var(--c-up)]" : due ? "bg-[color-mix(in_srgb,var(--c-down)_12%,transparent)] text-[var(--c-down)]" : "bg-[var(--c-surface-soft)] text-[var(--c-muted)]"}`}>
                    {decision.status === "reviewed" ? `已檢討 · 品質 ${decision.quality}/3` : due ? "檢討到期" : "追蹤中"}
                  </span>
                </div>
                {decision.reflection && <p className="mt-3 rounded-lg bg-[var(--c-surface-soft)] px-3 py-2 text-[12px] text-[var(--c-muted)]">檢討：{decision.reflection}</p>}
              </article>
            );
          })}
        </section>
      </main>
    </div>
  );
}
