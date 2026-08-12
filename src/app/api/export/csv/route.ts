import { createClient } from "@/lib/supabase/server";
import { EXPORT_CSV_HEADER, escapeCsvCell } from "@/lib/csv";

// CSV 匯出：所有自己帳戶的 transactions（RLS 已綁 user_id）。
// 帶 UTF-8 BOM，Excel 開啟中文不亂碼。
//
// Account cost basis 兩欄是「帳戶當前的成本基礎」，不是該筆交易當下的值——
// transactions 表沒有成本基礎欄位，逐筆歷史值在資料庫裡根本不存在。
// 同一帳戶的每一列都會印出同一個數字，這是刻意的：匯入端要的是終點狀態，
// 取每個帳戶最後一列即可還原。欄名冠上 Account 就是要講明這件事。
// 代價：手動刪列後再匯入，這個值仍屬於完整歷史，跟保留的子集對不上。

export const dynamic = "force-dynamic";

function cellNum(n: number | null | undefined): string {
  if (n === null || n === undefined) return "";
  const v = Number(n);
  return Number.isFinite(v) ? String(v) : "";
}

type Row = {
  created_at: string;
  type: string;
  quantity_after: number | null;
  unit_price: number | null;
  fx_rate: number | null;
  value_after_base: number | null;
  cashflow_twd: number | null;
  realized_pnl: number | null;
  fee_twd: number | null;
  note: string | null;
  accounts: {
    name: string;
    price_market: string;
    symbol: string | null;
    native_currency: string;
    cost_basis_twd: number | null;
    cost_basis_native: number | null;
  } | null;
};

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data, error } = await supabase
    .from("transactions")
    .select(
      "created_at,type,quantity_after,unit_price,fx_rate,value_after_base,cashflow_twd,realized_pnl,fee_twd,note,accounts(name,price_market,symbol,native_currency,cost_basis_twd,cost_basis_native)",
    )
    .order("created_at", { ascending: false });
  if (error) {
    return new Response(`Error: ${error.message}`, { status: 500 });
  }

  const rows = (data ?? []) as unknown as Row[];

  const header = EXPORT_CSV_HEADER.join(",");

  const lines: string[] = [header];
  for (const r of rows) {
    const acc = r.accounts;
    lines.push(
      [
        r.created_at,
        escapeCsvCell(acc?.name),
        escapeCsvCell(acc?.price_market),
        escapeCsvCell(acc?.symbol),
        escapeCsvCell(acc?.native_currency),
        r.type,
        cellNum(r.quantity_after),
        cellNum(r.unit_price),
        cellNum(r.fx_rate),
        cellNum(r.value_after_base),
        cellNum(r.cashflow_twd),
        cellNum(r.realized_pnl),
        cellNum(r.fee_twd),
        cellNum(acc?.cost_basis_twd),
        cellNum(acc?.cost_basis_native),
        escapeCsvCell(r.note),
      ].join(","),
    );
  }

  const csv = "﻿" + lines.join("\n");
  const today = new Date().toLocaleDateString("en-CA");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="portfolio-${today}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
