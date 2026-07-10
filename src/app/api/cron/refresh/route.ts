import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import { todayTaipei } from "@/lib/dates";
import { executeRecurringPlan } from "@/lib/contributions";
import { scanAlerts } from "@/lib/alerts-scan";
import { refreshAccountPrices } from "@/lib/refresh-prices";

export const dynamic = "force-dynamic";

async function runDuePlans(supabase: SupabaseClient) {
  const today = todayTaipei();
  const { data, error } = await supabase
    .from("recurring_plans")
    .select("id,account_id,next_run_date")
    .eq("active", true)
    .lte("next_run_date", today);
  if (error) return { ok: 0, skipped: 0, failed: 0, errors: [error.message] };

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
      errors.push(`plan ${plan.id}: ${(error as Error).message}`);
    }
  }

  return { ok, skipped, failed, errors };
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

  const supabase = createServiceClient();
  const refresh = await refreshAccountPrices(supabase);
  const plans = await runDuePlans(supabase);
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
