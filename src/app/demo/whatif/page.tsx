import { DemoV1Header } from "@/components/DemoV1Header";
import { PageHead } from "@/components/survey";
import { todayTaipei } from "@/lib/dates";
import { buildDemoV1Data } from "@/lib/demo-v1-data";
import { ScenarioTab, type ScenarioData } from "@/app/whatif/ScenarioTab";

export default function DemoWhatIfPage() {
  const data = buildDemoV1Data(todayTaipei());
  const scenario: ScenarioData = {
    holdings: data.scenarioHoldings,
    allocationTargets: { stock: 15, fund: 35, liquid_cash: 50 },
    concentrationLimitPct: 35,
    recentAddsByAccount: { "demo-us": 1 },
    openDecisionsByAccount: Object.fromEntries(
      data.scenarioHoldings.map((holding) => [
        holding.id,
        data.decisions.filter(
          (decision) =>
            decision.status === "open" &&
            (holding.symbol === decision.assetName || holding.name === decision.assetName),
        ).length,
      ]),
    ),
  };
  return (
    <div className="min-h-dvh bg-[var(--c-page)] text-[var(--c-text)]">
      <DemoV1Header active="scenario" />
      <main id="main" tabIndex={-1} className="mx-auto max-w-[1100px] px-4 pb-24 pt-8 sm:px-6">
        <PageHead
          className="mb-6"
          label="示範資料 · 重新整理即重置"
          title="壓力與買前檢核"
          sub="固定持倉可自由套用衝擊與試買金額；重新整理後回到相同初始資料。"
        />
        <ScenarioTab data={scenario} />
      </main>
    </div>
  );
}
