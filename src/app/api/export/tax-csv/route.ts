import { createClient } from "@/lib/supabase/server";
import { escapeCsvCell } from "@/lib/csv";

/**
 * 年度稅務報表（台灣海外所得，基本所得稅 / 最低稅負制）。
 *
 * 國稅局申報海外所得時，要列出每筆「處分」與「孳息」紀錄。本 endpoint 把
 * 一年內的賣出 / 配息 / 利息篩出來，按申報常用欄位整理成 CSV。
 *
 * 注意：
 * - 已實現損益 (TWD) 為應稅金額參考；實際申報仍須依當年度基本所得額門檻，
 *   並對照各家券商扣繳憑單。本表是「自記補強」用途，不能取代官方憑單。
 * - 用 BOM + Big5 兼容（UTF-8 with BOM）讓 Excel 直接開不亂碼。
 *
 * Query params:
 *   - year: 西元年（預設今年）。e.g. ?year=2025
 */

export const dynamic = "force-dynamic";

function cellNum(n: number | null | undefined, digits = 4): string {
  if (n === null || n === undefined) return "";
  const v = Number(n);
  return Number.isFinite(v) ? v.toFixed(digits) : "";
}

const TYPE_LABEL: Record<string, string> = {
  sell: "賣出",
  dividend: "配息",
  interest: "利息",
};

type Row = {
  created_at: string;
  type: string;
  quantity_after: number | null;
  unit_price: number | null;
  fx_rate: number | null;
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

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(request.url);
  const yearParam = url.searchParams.get("year");
  const year = yearParam
    ? Number(yearParam)
    : new Date().getFullYear();
  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    return new Response("Invalid year", { status: 400 });
  }

  // 抓該年度內的賣出 / 配息 / 利息
  const start = `${year}-01-01T00:00:00+08:00`;
  const end = `${year + 1}-01-01T00:00:00+08:00`;
  const { data, error } = await supabase
    .from("transactions")
    .select(
      "created_at,type,quantity_after,unit_price,fx_rate,cashflow_twd,realized_pnl,note,accounts(name,price_market,symbol,native_currency)",
    )
    .in("type", ["sell", "dividend", "interest"])
    .gte("created_at", start)
    .lt("created_at", end)
    .order("created_at", { ascending: true });
  if (error) {
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
  const rows = (data ?? []) as unknown as Row[];

  // 統計小計
  let totalRealized = 0;
  let totalCashflow = 0;
  for (const r of rows) {
    if (r.realized_pnl) totalRealized += Number(r.realized_pnl);
    if (r.cashflow_twd) totalCashflow += Number(r.cashflow_twd);
  }

  // CSV header
  // 註：單價/匯率僅 sell 紀錄有意義；dividend / interest 兩欄為空（金額看現金流入欄）。
  const header = [
    "日期",
    "類型",
    "帳戶",
    "市場",
    "標的代號",
    "原幣",
    "成交單價（僅賣出）",
    "匯率（僅賣出）",
    "現金流入（TWD）",
    "已實現損益（TWD）",
    "備註",
  ]
    .map(escapeCsvCell)
    .join(",");

  const lines: string[] = [header];
  for (const r of rows) {
    const acc = r.accounts;
    const date = r.created_at.slice(0, 10);
    // dividend / interest 的 unit_price / fx_rate 是 null（由 importIncomeCsv 寫入），輸出為空字串
    lines.push(
      [
        escapeCsvCell(date),
        escapeCsvCell(TYPE_LABEL[r.type] ?? r.type),
        escapeCsvCell(acc?.name),
        escapeCsvCell(acc?.price_market),
        escapeCsvCell(acc?.symbol),
        escapeCsvCell(acc?.native_currency),
        cellNum(r.unit_price),
        cellNum(r.fx_rate, 6),
        cellNum(r.cashflow_twd, 0),
        cellNum(r.realized_pnl, 0),
        escapeCsvCell(r.note),
      ].join(","),
    );
  }

  // 小計列
  lines.push(""); // 空行分隔
  lines.push(
    [
      "",
      escapeCsvCell("年度小計"),
      "",
      "",
      "",
      "",
      "",
      "",
      cellNum(totalCashflow, 0),
      cellNum(totalRealized, 0),
      "",
    ].join(","),
  );

  const csv = "﻿" + lines.join("\r\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="tax-report-${year}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
