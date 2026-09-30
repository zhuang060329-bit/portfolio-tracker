import { getCachedTwTotalReturnSeries } from "@/lib/prices/finmind-total-return-cached";
import {
  buildDcaTierStatus,
  dcaTierFetchErrorMessage,
  type DcaTierStatus,
} from "@/lib/dca-tier-status";
import { parseStoredDcaTierConfig } from "@/lib/schemas/domain/dca-tier-config";
import {
  RecurringPlanList,
  type Plan,
  type PlanTierStatuses,
} from "./RecurringPlans";

/**
 * 有級距計畫的帳戶才會渲染這個元件：抓含息序列、算出每個級距計畫的狀態，
 * 再交給 client 端的清單。page.tsx 用 Suspense 包住它，抓資料時頁面其他部分先出來。
 *
 * 含息序列一個帳戶只抓一次，所有計畫共用；不同計畫只差在級距設定與基準金額。
 * 抓不到時不擋頁面：每個級距計畫各帶一則錯誤，畫面退回基準金額。
 */
export async function TieredPlanList({
  plans,
  symbol,
}: {
  plans: Plan[];
  symbol: string;
}) {
  let totalReturn: Awaited<ReturnType<typeof getCachedTwTotalReturnSeries>> | null =
    null;
  let fetchError: string | null = null;
  try {
    totalReturn = await getCachedTwTotalReturnSeries(symbol);
  } catch (error) {
    fetchError = dcaTierFetchErrorMessage(error);
    // 只記訊息本身（fetchWithRetry 的錯誤只帶主機名，不含 token），不記使用者或帳戶。
    console.error(
      "[dca-tier] 含息序列抓取失敗：",
      error instanceof Error ? error.message : "unknown",
    );
  }

  const tiers: PlanTierStatuses = {};
  for (const plan of plans) {
    const stored = parseStoredDcaTierConfig(plan.tier_config);
    if (stored.kind === "none") continue;
    tiers[plan.id] = tierStatusFor(stored, totalReturn, fetchError, plan);
  }

  return <RecurringPlanList plans={plans} tiers={tiers} />;
}

function tierStatusFor(
  stored: Exclude<ReturnType<typeof parseStoredDcaTierConfig>, { kind: "none" }>,
  totalReturn: Awaited<ReturnType<typeof getCachedTwTotalReturnSeries>> | null,
  fetchError: string | null,
  plan: Plan,
): DcaTierStatus {
  // 設定壞掉時不拿預設值頂替：使用者以為在跑自己的級距，實際卻是另一組。
  if (stored.kind === "invalid") {
    return { ok: false, error: "這個計劃存的級距設定讀不出來" };
  }
  if (!totalReturn) {
    return { ok: false, error: fetchError ?? "抓不到歷史股價" };
  }
  return buildDcaTierStatus(totalReturn, stored.config, Number(plan.amount_twd));
}
