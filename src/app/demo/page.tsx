import type { Metadata } from "next";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { buildDashboardData } from "@/lib/dashboard-data";
import { buildDemoInputs } from "@/lib/demo-data";
import { todayTaipei } from "@/lib/dates";
import { DemoV1Header } from "@/components/DemoV1Header";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "StackWorth — Demo",
  description:
    "Interactive demo of StackWorth, a personal portfolio tracker. Generated data, real computation pipeline.",
};

export default function DemoPage() {
  const today = todayTaipei();
  const dashboard = buildDashboardData(buildDemoInputs(today));

  return (
    <div className="min-h-screen bg-[var(--c-page)] text-[var(--c-text)]">
      <DemoV1Header active="overview" />

      <main className="mx-auto max-w-[1200px] px-4 pb-24 pt-5 sm:px-6 sm:pt-7 lg:px-7 lg:pt-8">
        <p className="mb-3 max-w-2xl text-[11px] leading-relaxed text-[var(--c-muted)] sm:text-[12px]">
          展示資料由固定種子生成，並非真實持倉；XIRR、TWR、Sharpe 與回撤皆使用正式版相同的計算管線。
        </p>
        <DashboardClient data={dashboard} demo />
      </main>
    </div>
  );
}
