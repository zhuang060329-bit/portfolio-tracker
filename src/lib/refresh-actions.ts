"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { refreshAccountPrices } from "@/lib/refresh-prices";

// 手動刷新自己的報價（RLS client → 只碰得到自己的帳戶）。
// 冷卻 10 分鐘：以自己 active 非手動帳戶的 max(last_priced_at) 判斷，
// 不另存狀態，跨裝置一致，cron 剛跑完也一樣算在冷卻內（避免重複打免費額度）。

const COOLDOWN_MS = 10 * 60 * 1000;

export type RefreshState =
  | { ok: true; refreshed: number; failed: number }
  | { ok: false; error: string; waitSec?: number };

export async function refreshMyPrices(): Promise<RefreshState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "未登入" };

  const { data: rows, error: qErr } = await supabase
    .from("accounts")
    .select("last_priced_at")
    .neq("price_market", "manual")
    .not("symbol", "is", null)
    .eq("status", "active");
  if (qErr) return { ok: false, error: qErr.message };
  if (!rows || rows.length === 0)
    return { ok: false, error: "沒有可刷新的帳戶" };

  const latest = rows
    .map((r) => (r.last_priced_at ? new Date(r.last_priced_at).getTime() : 0))
    .reduce((a, b) => Math.max(a, b), 0);
  const elapsed = Date.now() - latest;
  if (elapsed < COOLDOWN_MS) {
    const waitSec = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
    return { ok: false, error: "冷卻中", waitSec };
  }

  const res = await refreshAccountPrices(supabase);
  revalidatePath("/");
  if (res.ok === 0 && res.failed > 0)
    return { ok: false, error: res.errors[0] ?? "全部刷新失敗" };
  return { ok: true, refreshed: res.ok, failed: res.failed };
}
