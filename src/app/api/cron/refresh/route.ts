import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import { todayTaipei } from "@/lib/dates";
import { executeRecurringPlan } from "@/lib/contributions";
import { scanAlerts } from "@/lib/alerts-scan";
import { refreshAccountPrices, type MarketStat } from "@/lib/refresh-prices";
import { PROVIDER_LABEL } from "@/lib/prices/router";
import type { Market } from "@/lib/prices/types";

export const dynamic = "force-dynamic";

// cron 是無人值守的，出事只能靠 log 回頭查。
// 一律只印計數與識別碼，不印 exception 原文（那可能帶出 Postgres schema 細節），
// 也不印任何 env var 值、email 或 user_id。
const TAG = "[cron/refresh]";

// 印成 `TwelveData=8/0 FinMind=3/1 CoinGecko=0/0` 的形式（ok/failed）。
// 該市場一個帳戶都沒有時印 `-/-`，和「有帳戶且全部成功」區分開——
// 兩者都是 failed=0，但只有前者代表這家上游今天根本沒被呼叫到。
function formatMarketStats(
  byMarket: Record<string, MarketStat> | undefined,
): string {
  return (Object.keys(PROVIDER_LABEL) as Market[])
    .map((market) => {
      const stat = byMarket?.[market];
      const value = stat ? `${stat.ok}/${stat.failed}` : "-/-";
      return `${PROVIDER_LABEL[market]}=${value}`;
    })
    .join(" ");
}

async function runDuePlans(supabase: SupabaseClient) {
  const today = todayTaipei();
  const { data, error } = await supabase
    .from("recurring_plans")
    .select("id,account_id,next_run_date")
    .eq("active", true)
    .lte("next_run_date", today);
  if (error) {
    // queryFailed 是必要的：沒有它，「查詢掛掉」與「今天沒有到期的計畫」
    // 都是 ok=0 skipped=0 failed=0，監控只會看到一切正常。
    return {
      ok: 0,
      skipped: 0,
      failed: 0,
      queryFailed: true,
      errors: [`查詢定期定額計畫失敗 code=${error.code ?? "unknown"}`],
    };
  }

  let ok = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const plan of data ?? []) {
    try {
      const { data: account, error: accountError } = await supabase
        .from("accounts")
        .select("price_market,symbol,status")
        .eq("id", plan.account_id)
        .single();
      if (accountError || !account) {
        failed++;
        errors.push(`plan ${plan.id}: 找不到帳戶`);
        continue;
      }

      const result = await executeRecurringPlan({
        supabase,
        planId: plan.id,
        expectedRunDate: plan.next_run_date,
        account,
        source: "cron",
      });
      if (!result.ok) {
        failed++;
        errors.push(`plan ${plan.id}: ${result.error}`);
        continue;
      }
      if (!result.executed) {
        skipped++;
        continue;
      }

      ok++;
    } catch (error) {
      failed++;
      // 原文只進 log，不回給呼叫端。
      console.error(`${TAG} plan ${plan.id} 例外`, error);
      errors.push(`plan ${plan.id}: 執行失敗`);
    }
  }

  return { ok, skipped, failed, queryFailed: false, errors };
}

export async function GET(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  const actualBuffer = Buffer.from(auth);
  const expectedBuffer = Buffer.from(expected);
  const matches =
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer);
  if (!process.env.CRON_SECRET || !matches) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const today = todayTaipei();
  console.log(`${TAG} 開始 at=${new Date(startedAt).toISOString()} today=${today}`);

  const supabase = createServiceClient();

  const refreshStart = Date.now();
  const refresh = await refreshAccountPrices(supabase);
  console.log(
    `${TAG} 報價 ok=${refresh.ok} failed=${refresh.failed}` +
      ` queryFailed=${refresh.queryFailed ?? false}` +
      ` ${formatMarketStats(refresh.byMarket)}` +
      ` ms=${Date.now() - refreshStart}`,
  );

  const plansStart = Date.now();
  const plans = await runDuePlans(supabase);
  console.log(
    `${TAG} 定期定額 ok=${plans.ok} skipped=${plans.skipped}` +
      ` failed=${plans.failed} queryFailed=${plans.queryFailed}` +
      ` ms=${Date.now() - plansStart}`,
  );

  const alertsStart = Date.now();
  const alerts = await scanAlerts(supabase);
  console.log(
    `${TAG} 警示 triggered=${alerts.triggered}` +
      ` queryFailed=${alerts.queryFailed}` +
      ` errors=${alerts.errors.length}` +
      ` ms=${Date.now() - alertsStart}`,
  );

  const finishedAt = Date.now();
  console.log(
    `${TAG} 結束 at=${new Date(finishedAt).toISOString()}` +
      ` totalMs=${finishedAt - startedAt}`,
  );

  return NextResponse.json({
    ok: true,
    at: new Date(finishedAt).toISOString(),
    today,
    durationMs: finishedAt - startedAt,
    refresh,
    plans,
    alerts,
  });
}
