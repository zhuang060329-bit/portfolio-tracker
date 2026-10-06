import { DemoV1Header } from "@/components/DemoV1Header";
import { PageHead } from "@/components/survey";
import { todayTaipei } from "@/lib/dates";
import { DEMO_ALLOCATION_TARGETS, DEMO_CONCENTRATION_LIMIT_PCT } from "@/lib/demo-data";
import { demoMetadata } from "@/lib/demo-metadata";
import { buildDemoV1Data, countRecentAdds } from "@/lib/demo-v1-data";
import { ScenarioTab, type ScenarioData } from "@/app/whatif/ScenarioTab";

export const metadata = demoMetadata("壓力與買前檢核", "壓力測試示範：對固定持倉套用衝擊情境與試買金額，看淨值與各標的權重怎麼變。");

export default function DemoWhatIfPage() {
  const today = todayTaipei();
  const data = buildDemoV1Data(today);
  const scenario: ScenarioData = {
    holdings: data.scenarioHoldings,
    allocationTargets: { ...DEMO_ALLOCATION_TARGETS },
    concentrationLimitPct: DEMO_CONCENTRATION_LIMIT_PCT,
    recentAddsByAccount: countRecentAdds(data.transactions, today),
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
      <main id="main" tabIndex={-1} className="mx-auto max-w-[1200px] px-4 pb-24 pt-5 sm:px-6 sm:pt-7 lg:px-7 lg:pt-8">
        <PageHead
          className="mb-6"
          label="示範資料 · 重新整理即重置"
          title="壓力與買前檢核"
          sub="固定持倉可自由套用衝擊與試買金額；重新整理後回到相同初始資料。"
        />
        <ScenarioTab data={scenario} frameWeights relevantTemplatesOnly standardFields />
      </main>
    </div>
  );
}
