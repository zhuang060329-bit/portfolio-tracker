import { DemoV1Header } from "@/components/DemoV1Header";
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
    <div className="min-h-screen bg-[var(--c-page)] text-[var(--c-text)]">
      <DemoV1Header active="scenario" />
      <main className="mx-auto max-w-[1100px] px-4 pb-24 pt-8 sm:px-6">
        <h1 className="font-serif text-3xl font-medium">壓力與買前檢核 Demo</h1>
        <p className="mb-5 mt-1.5 text-[13px] text-[var(--c-muted)]">固定持倉可自由套用衝擊與試買金額；重新整理後回到相同初始資料。</p>
        <ScenarioTab data={scenario} />
      </main>
    </div>
  );
}
