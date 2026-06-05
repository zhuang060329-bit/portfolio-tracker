import { createClient } from "@/lib/supabase/server";

// CSV 匯出：所有自己帳戶的 transactions（RLS 已綁 user_id）。
// 帶 UTF-8 BOM，Excel 開啟中文不亂碼。

export const dynamic = "force-dynamic";

function csvEscape(s: string | null | undefined): string {
  if (s === null || s === undefined) return "";
  const str = String(s);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

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
  note: string | null;
  accounts: {
    name: string;
    price_market: string;
    symbol: string | null;
    native_currency: string;
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
      "created_at,type,quantity_after,unit_price,fx_rate,value_after_base,cashflow_twd,realized_pnl,note,accounts(name,price_market,symbol,native_currency)",
    )
    .order("created_at", { ascending: false });
  if (error) {
    return new Response(`Error: ${error.message}`, { status: 500 });
  }

  const rows = (data ?? []) as unknown as Row[];

  const header = [
    "Datetime",
    "Account",
    "Market",
    "Symbol",
    "Native",
    "Type",
    "Qty after",
    "Unit price (native)",
    "FX",
    "Value (TWD)",
    "Cashflow (TWD)",
    "Realized PnL (TWD)",
    "Note",
  ].join(",");

  const lines: string[] = [header];
  for (const r of rows) {
    const acc = r.accounts;
    lines.push(
      [
        r.created_at,
        csvEscape(acc?.name),
        csvEscape(acc?.price_market),
        csvEscape(acc?.symbol),
        csvEscape(acc?.native_currency),
        r.type,
        cellNum(r.quantity_after),
        cellNum(r.unit_price),
        cellNum(r.fx_rate),
        cellNum(r.value_after_base),
        cellNum(r.cashflow_twd),
        cellNum(r.realized_pnl),
        csvEscape(r.note),
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
