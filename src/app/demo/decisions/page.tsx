import { DemoV1Header } from "@/components/DemoV1Header";
import { PageHead, Tag } from "@/components/survey";
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
    <div className="min-h-dvh bg-[var(--c-page)] text-[var(--c-text)]">
      <DemoV1Header active="decisions" />
      <main id="main" tabIndex={-1} className="mx-auto max-w-[880px] px-4 pb-24 pt-8 sm:px-6">
        <PageHead
          label={`示範資料 · ${data.decisions.length} 筆決策`}
          title="決策日誌"
          sub="固定假資料展示追蹤中、到期與已完成檢討三種狀態。"
        />
        <section className="mt-6 border border-[var(--c-border)] bg-[var(--c-surface)]">
          {data.decisions.map((decision, index) => {
            const due = decision.status === "open" && decision.reviewDate <= today;
            return (
              <article key={decision.id} className={`p-5 ${index > 0 ? "border-t border-[var(--c-border)]" : ""}`}>
                <div className="flex flex-wrap items-center gap-2.5">
                  <Tag tone="accent">{typeLabel[decision.decisionType] ?? decision.decisionType}</Tag>
                  <h2 className="text-[length:var(--fs-md)] font-semibold">{decision.assetName}</h2>
                  <span className="ml-auto text-[length:var(--fs-micro)] text-[var(--c-faint)] tnum">{decision.decisionDate}</span>
                </div>
                <p className="mt-2 max-w-[68ch] text-[length:var(--fs-sm)] leading-6 text-[var(--c-muted)]">{decision.thesis}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2.5 text-[length:var(--fs-micro)]">
                  <span className="text-[var(--c-muted)]">
                    檢討日 <span className="tnum text-[var(--c-text)]">{decision.reviewDate}</span>
                  </span>
                  {/* 到期是唯一要人做事的狀態，走朱砂虛線框；已檢討是結果，走實線綠框 */}
                  <Tag tone={decision.status === "reviewed" ? "up" : due ? "annot" : "quiet"}>
                    {decision.status === "reviewed" ? (
                      <>已檢討 · 品質 <span className="tnum">{decision.quality}/3</span></>
                    ) : due ? "檢討到期" : "追蹤中"}
                  </Tag>
                </div>
                {decision.reflection && (
                  <p className="mt-3 border-l-2 border-[var(--c-line-strong)] pl-3 text-[length:var(--fs-sm)] leading-6 text-[var(--c-muted)]">
                    <span className="font-semibold text-[var(--c-text)]">檢討</span>　{decision.reflection}
                  </p>
                )}
              </article>
            );
          })}
        </section>
      </main>
    </div>
  );
}
