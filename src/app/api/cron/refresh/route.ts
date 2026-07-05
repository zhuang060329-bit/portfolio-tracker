import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import { todayTaipei } from "@/lib/dates";
import {
  applyContribution,
  nextMonthlyAfter,
  type ContributionAccount,
} from "@/lib/contributions";
import { scanAlerts } from "@/lib/alerts-scan";
import { refreshAccountPrices } from "@/lib/refresh-prices";

// Vercel Cron 每日呼叫此路由。
// 1) 刷所有非手動帳戶的最新市價（更新 accounts.last_* + upsert 今日 snapshot）。
// 2) 執行所有 active 且 next_run_date <= today 的定期定額計劃。
// Vercel 會自動帶 Authorization: Bearer ${CRON_SECRET} 進來，cron 路由須驗。

// 強制動態，不被 build-time 預渲染。
export const dynamic = "force-dynamic";

async function runDuePlans(supabase: SupabaseClient) {
  const today = todayTaipei();
  const { data, error } = await supabase
    .from("recurring_plans")
    .select("id,user_id,account_id,amount_twd,day_of_month,next_run_date")
    .eq("active", true)
    .lte("next_run_date", today);
  if (error) return { ok: 0, failed: 0, errors: [error.message] };

  let ok = 0;
  let failed = 0;
  const errors: string[] = [];
  for (const plan of data ?? []) {
    try {
      const { data: account, error: aErr } = await supabase
        .from("accounts")
        .select(
          "id,user_id,price_market,symbol,quantity,native_currency,last_unit_price,last_fx_rate,cost_basis_twd,cost_basis_native,realized_pnl_twd,status",
        )
        .eq("id", plan.account_id)
        .single();
      if (aErr || !account) {
        failed++;
        errors.push(`plan ${plan.id}: 找不到帳戶`);
        continue;
      }
      if (account.status === "archived") {
        failed++;
        errors.push(`plan ${plan.id}: 帳戶已歸檔，跳過`);
        continue;
      }

      const res = await applyContribution({
        supabase,
        userId: plan.user_id,
        account: account as ContributionAccount,
        twd: Number(plan.amount_twd),
        priceOverride: null,
        fxOverride: null,
        occurredAt: new Date(),
        noteSuffix: "定期定額(cron)",
      });
      if (!res.ok) {
        failed++;
        errors.push(`plan ${plan.id}: ${res.error}`);
        continue;
      }

      await supabase
        .from("recurring_plans")
        .update({
          last_run_date: today,
          next_run_date: nextMonthlyAfter(today, plan.day_of_month),
          updated_at: new Date().toISOString(),
        })
        .eq("id", plan.id);

      ok++;
    } catch (e) {
      failed++;
      errors.push(`plan ${plan.id}: ${(e as Error).message}`);
    }
  }
  return { ok, failed, errors };
}

export async function GET(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  // timingSafeEqual：等長比較，避免 !== 逐字元短路可被計時側信道利用
  const a = Buffer.from(auth);
  const b = Buffer.from(expected);
  const match = a.length === b.length && timingSafeEqual(a, b);
  if (!process.env.CRON_SECRET || !match) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const refresh = await refreshAccountPrices(supabase);
  const plans = await runDuePlans(supabase);
  // 抓完價、跑完定期定額之後再掃警示，這樣警示用到的是當天最新的資料。
  const alerts = await scanAlerts(supabase);

  return NextResponse.json({
    ok: true,
    at: new Date().toISOString(),
    today: todayTaipei(),
    refresh,
    plans,
    alerts,
  });
}
