"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  hasCostBasisColumns,
  mapHeader,
  missingRequiredColumns,
} from "@/lib/csv-import-helpers";
import {
  buildImportPlan,
  dedupeKey,
  parseCsvLine,
  parseRows,
  type PlanAccount,
} from "@/lib/csv-import-plan";

export type ImportResult =
  | {
      ok: true;
      imported: number;
      skipped: number;
      errors: string[];
    }
  | { ok: false; error: string }
  | undefined;

/**
 * CSV 匯入：支援全部七種交易型別，欄位可中英文，也吃得下 /api/export/csv 的匯出檔。
 *
 * 必要欄位（含別名）：date / account / type，加上金額擇一（amount 或 Cashflow (TWD)）。
 * 其餘欄位有就用、沒有就退回較保守的行為。
 *
 * 兩條規則值得先知道：
 * 1. 部位異動（買進 / 賣出 / 餘額調整 / 建立）只能匯進「還沒有任何交易」的帳戶。
 *    這些列設定的是絕對狀態，寫進已有歷史的帳戶等於拿另一段歷史的終值覆蓋現況。
 *    配息與利息是增量，不受此限，行為與先前完全相同。
 * 2. 同帳戶、同時間、同型別視為重複，直接跳過並回報，避免同一份檔案匯兩次
 *    把部位變成兩倍。
 */
export async function importTransactionsCsv(
  _prev: ImportResult,
  formData: FormData,
): Promise<ImportResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "請選擇 CSV 檔" };
  }
  if (file.size > 1024 * 1024) {
    return { ok: false, error: "檔案超過 1 MB" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "請先登入" };

  const text = (await file.text()).replace(/^﻿/, "");
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { ok: false, error: "CSV 沒有資料列" };

  const header = parseCsvLine(lines[0]).map((h) =>
    h.trim().toLowerCase().replace(/^"|"$/g, ""),
  );
  const cols = mapHeader(header);
  const missing = missingRequiredColumns(cols);
  if (missing.length > 0) {
    return { ok: false, error: `CSV 缺少必要欄位：${missing.join("、")}` };
  }
  const hasCostBasis = hasCostBasisColumns(cols);

  const { rows, errors: parseErrors } = parseRows(lines, cols);

  const { data: accountRows, error: accErr } = await supabase
    .from("accounts")
    .select(
      "id,name,price_market,quantity,manual_value_base,last_unit_price,last_fx_rate,realized_pnl_twd",
    );
  if (accErr) {
    console.error(
      `[importTransactionsCsv] 查詢帳戶失敗 code=${accErr.code ?? "unknown"}`,
    );
    return { ok: false, error: "讀取帳戶失敗，請稍後再試" };
  }

  const referenced = new Set(rows.map((r) => r.accountName));
  const relevant = (accountRows ?? []).filter((a) =>
    referenced.has(a.name.trim()),
  );

  const history = await loadHistory(
    supabase,
    relevant.map((a) => a.id),
  );
  if (history === null) {
    return { ok: false, error: "讀取既有交易失敗，請稍後再試" };
  }

  const accountsByName = new Map<string, PlanAccount>();
  for (const a of relevant) {
    const seen = history.get(a.id);
    accountsByName.set(a.name.trim(), {
      id: a.id,
      name: a.name.trim(),
      priceMarket: a.price_market,
      quantity: Number(a.quantity ?? 0),
      manualValueBase:
        a.manual_value_base == null ? null : Number(a.manual_value_base),
      lastUnitPrice:
        a.last_unit_price == null ? null : Number(a.last_unit_price),
      lastFxRate: a.last_fx_rate == null ? null : Number(a.last_fx_rate),
      realizedPnlTwd: Number(a.realized_pnl_twd ?? 0),
      hasExistingTransactions: (seen?.size ?? 0) > 0,
      existingKeys: seen ?? new Set<string>(),
    });
  }

  const plan = buildImportPlan(rows, accountsByName, { hasCostBasis });
  const errors = [...parseErrors, ...plan.errors];
  const skipped = parseErrors.length + plan.skipped;

  if (plan.transactions.length === 0) {
    return { ok: true, imported: 0, skipped, errors };
  }

  const { error: insErr } = await supabase.from("transactions").insert(
    plan.transactions.map((t) => ({ ...t, user_id: user.id })),
  );
  if (insErr) {
    console.error(
      `[importTransactionsCsv] 寫入交易失敗 code=${insErr.code ?? "unknown"}`,
    );
    return { ok: false, error: "寫入交易失敗，沒有任何資料被匯入" };
  }

  // 交易已經寫進去了，接著才更新帳戶終態。兩者不在同一個 transaction 裡：
  // 這裡若失敗，流水在、帳戶餘額沒跟上，而且重試會被「帳戶已有交易」擋住。
  // 訊息必須講清楚，讓使用者知道要去看變動紀錄而不是重按一次。
  for (const { accountId, patch } of plan.accountPatches) {
    const { error: updErr } = await supabase
      .from("accounts")
      .update(patch)
      .eq("id", accountId);
    if (updErr) {
      console.error(
        `[importTransactionsCsv] 更新帳戶失敗 code=${updErr.code ?? "unknown"}`,
      );
      return {
        ok: false,
        error:
          "交易已寫入但帳戶餘額更新失敗。請到變動紀錄確認已匯入的內容，不要重複匯入",
      };
    }
  }

  revalidatePath("/activity");
  revalidatePath("/");

  return { ok: true, imported: plan.imported, skipped, errors };
}

/**
 * 撈出這些帳戶既有交易的指紋，供重複偵測與「帳戶是否全新」判斷。
 * 查詢失敗回 null——寧可整份退回，也不要因為查不到而把重複偵測整個關掉。
 */
async function loadHistory(
  supabase: Awaited<ReturnType<typeof createClient>>,
  accountIds: string[],
): Promise<Map<string, Set<string>> | null> {
  const byAccount = new Map<string, Set<string>>();
  if (accountIds.length === 0) return byAccount;

  const { data, error } = await supabase
    .from("transactions")
    .select("account_id,type,created_at")
    .in("account_id", accountIds)
    .limit(20000);
  if (error) {
    console.error(
      `[importTransactionsCsv] 查詢既有交易失敗 code=${error.code ?? "unknown"}`,
    );
    return null;
  }

  for (const t of data ?? []) {
    const set = byAccount.get(t.account_id) ?? new Set<string>();
    set.add(dedupeKey(t.type, new Date(t.created_at)));
    byAccount.set(t.account_id, set);
  }
  return byAccount;
}
