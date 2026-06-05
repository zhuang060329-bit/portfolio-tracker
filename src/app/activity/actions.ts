"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  HEADER_ALIASES,
  findHeaderIndex,
  normalizeType,
  parseAmount,
  parseFlexibleDate,
} from "@/lib/csv-import-helpers";

export type ImportResult =
  | {
      ok: true;
      imported: number;
      skipped: number;
      errors: string[];
    }
  | { ok: false; error: string }
  | undefined;

// 簡易 CSV line parser（支援引號跳脫）
function parseCsvLine(line: string): string[] {
  const cols: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") {
        cols.push(cur);
        cur = "";
      } else cur += c;
    }
  }
  cols.push(cur);
  return cols;
}

// CSV 匯入：支援 dividend / interest 兩種型別，欄位可中英文。
// 必要欄位（含別名）：date / account / type / amount
// 選填：note
// type 可以是 dividend / interest / 配息 / 股息 / 利息 等
// 日期支援 ISO / yyyy/m/d / m/d/yyyy 多種格式
// account 用名稱比對，找不到就跳過該列。
export async function importIncomeCsv(
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
  const dateI = findHeaderIndex(header, HEADER_ALIASES.date);
  const accI = findHeaderIndex(header, HEADER_ALIASES.account);
  const typeI = findHeaderIndex(header, HEADER_ALIASES.type);
  const amountI = findHeaderIndex(header, HEADER_ALIASES.amount);
  const noteI = findHeaderIndex(header, HEADER_ALIASES.note);
  if (dateI < 0 || accI < 0 || typeI < 0 || amountI < 0) {
    return {
      ok: false,
      error:
        "CSV 缺少必要欄位：日期(date) / 帳戶(account) / 類型(type) / 金額(amount / amount_twd)",
    };
  }

  // 預先抓使用者所有帳戶供名稱比對
  const { data: accs } = await supabase
    .from("accounts")
    .select(
      "id,name,quantity,manual_value_base,price_market,last_unit_price,last_fx_rate,realized_pnl_twd",
    );
  const accByName = new Map<string, NonNullable<typeof accs>[number]>();
  for (const a of accs ?? []) {
    accByName.set(a.name.trim(), a);
  }

  type Row = {
    accId: string;
    type: "dividend" | "interest";
    amount: number;
    occurredAt: Date;
    note: string | null;
    curValue: number;
    qty: number;
  };
  const rows: Row[] = [];
  const errors: string[] = [];
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const dateStr = (cols[dateI] ?? "").trim();
    const accName = (cols[accI] ?? "").trim();
    const typeRaw = (cols[typeI] ?? "").trim();
    const amount = parseAmount(cols[amountI] ?? "");
    const note = noteI >= 0 ? (cols[noteI] ?? "").trim() || null : null;

    if (!dateStr || !accName) {
      skipped++;
      errors.push(`第 ${i + 1} 列：date / account 為空`);
      continue;
    }
    const type = normalizeType(typeRaw);
    if (!type) {
      skipped++;
      errors.push(
        `第 ${i + 1} 列：type "${typeRaw}" 無法辨識（須為配息/股息/dividend 或利息/interest）`,
      );
      continue;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      skipped++;
      errors.push(`第 ${i + 1} 列：金額須為正數`);
      continue;
    }
    const occurredAt = parseFlexibleDate(dateStr);
    if (!occurredAt) {
      skipped++;
      errors.push(`第 ${i + 1} 列：date "${dateStr}" 格式無效`);
      continue;
    }
    const acc = accByName.get(accName);
    if (!acc) {
      skipped++;
      errors.push(`第 ${i + 1} 列：找不到帳戶「${accName}」`);
      continue;
    }

    const curValue =
      acc.price_market === "manual"
        ? Number(acc.manual_value_base ?? 0)
        : Number(acc.quantity) *
          Number(acc.last_unit_price ?? 0) *
          Number(acc.last_fx_rate ?? 1);

    rows.push({
      accId: acc.id,
      type,
      amount,
      occurredAt,
      note,
      curValue,
      qty: Number(acc.quantity),
    });
  }

  if (rows.length === 0) {
    return { ok: true, imported: 0, skipped, errors };
  }

  // 批次 insert transactions
  const txInserts = rows.map((r) => ({
    user_id: user.id,
    account_id: r.accId,
    type: r.type,
    quantity_after: r.qty,
    unit_price: null,
    fx_rate: null,
    value_after_base: r.curValue,
    realized_pnl: r.amount,
    cashflow_twd: r.amount,
    note: r.note ? `${r.type === "dividend" ? "配息" : "利息"} ${r.amount} TWD · ${r.note}` : `${r.type === "dividend" ? "配息" : "利息"} ${r.amount} TWD`,
    created_at: r.occurredAt.toISOString(),
  }));
  const { error: insErr } = await supabase
    .from("transactions")
    .insert(txInserts);
  if (insErr) return { ok: false, error: `寫入失敗：${insErr.message}` };

  // 加總每個帳戶的增量並 update realized_pnl_twd
  const deltaByAcc = new Map<string, number>();
  for (const r of rows) {
    deltaByAcc.set(r.accId, (deltaByAcc.get(r.accId) ?? 0) + r.amount);
  }
  for (const [accId, delta] of deltaByAcc.entries()) {
    const acc = (accs ?? []).find((a) => a.id === accId);
    if (!acc) continue;
    await supabase
      .from("accounts")
      .update({
        realized_pnl_twd: Number(acc.realized_pnl_twd ?? 0) + delta,
      })
      .eq("id", accId);
  }

  revalidatePath("/activity");
  revalidatePath("/");

  return { ok: true, imported: rows.length, skipped, errors };
}
