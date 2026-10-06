import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { buildDashboardData } from "@/lib/dashboard-data";
import { buildDemoInputs } from "@/lib/demo-data";
import { todayTaipei } from "@/lib/dates";
import { demoMetadata } from "@/lib/demo-metadata";
import { DemoV1Header } from "@/components/DemoV1Header";

export const dynamic = "force-dynamic";

export const metadata = demoMetadata(
  "投資組合總覽",
  "StackWorth 公開示範：固定種子生成的持倉，淨值、配置、XIRR、TWR 與回撤都走正式版相同的計算管線。",
);

export default function DemoPage() {
  const today = todayTaipei();
  const dashboard = compactSeries(buildDashboardData(buildDemoInputs(today)));

  return (
    <div className="min-h-dvh bg-[var(--c-page)] text-[var(--c-text)]">
      <DemoV1Header active="overview" />

      <main id="main" tabIndex={-1} className="mx-auto max-w-[1200px] px-4 pb-24 pt-5 sm:px-6 sm:pt-7 lg:px-7 lg:pt-8">
        <p className="mb-3 max-w-2xl text-[length:var(--fs-micro)] leading-relaxed text-[var(--c-muted)]">
          展示資料由固定種子生成，並非真實持倉；XIRR、TWR、Sharpe 與回撤皆使用正式版相同的計算管線。
        </p>
        <DashboardClient data={dashboard} demo />
      </main>
    </div>
  );
}

// 大盤對照序列（約 650 天 × 5 欄）會整包序列化進 HTML，全精度浮點（如 19687.24574718694）
// 占了這一頁 HTML 的一大塊。圖表只拿它換算成「相對區間起點」的百分比、顯示到 0.1%。
// 留 10 位有效數字：以 2026-10-06 的資料窮舉每個起點 × 每一天 × 每條線（約 104 萬個顯示值）
// 與全精度逐字相同；8 位時有 32 個落在 x.x5 邊界的值會差 0.1%。
// 淨值序列不動：收斂到不改變任何顯示的精度（12 位）只省 1.6 KB。
type Dashboard = ReturnType<typeof buildDashboardData>;
function compactSeries(data: Dashboard): Dashboard {
  const sig = (v: number | string | undefined) => (typeof v === "number" ? Number(v.toPrecision(10)) : v);
  return {
    ...data,
    perf: data.perf.map((p) => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, sig(v)])) as Dashboard["perf"][number]),
  };
}
