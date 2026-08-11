import { describe, expect, it } from "vitest";
import {
  classifyRow,
  findHeaderIndex,
  hasCostBasisColumns,
  HEADER_ALIASES,
  mapHeader,
  missingRequiredColumns,
  normalizeType,
  parseAmount,
  parseFlexibleDate,
  type RowFacts,
} from "./csv-import-helpers";

/** /api/export/csv 目前輸出的表頭，已照匯入端的方式轉小寫。 */
const EXPORT_HEADER = [
  "datetime",
  "account",
  "market",
  "symbol",
  "native",
  "type",
  "qty after",
  "unit price (native)",
  "fx",
  "value (twd)",
  "cashflow (twd)",
  "realized pnl (twd)",
  "fee (twd)",
  "note",
];

/** 階段 8b 之後的表頭：成本基礎兩欄插在 Fee 與 Note 之間。 */
const EXPORT_HEADER_V2 = [
  ...EXPORT_HEADER.slice(0, 13),
  "cost basis (twd)",
  "cost basis (native)",
  "note",
];

describe("findHeaderIndex", () => {
  it("找到第一個匹配的別名", () => {
    expect(findHeaderIndex(["日期", "帳戶", "金額"], HEADER_ALIASES.date)).toBe(0);
    expect(findHeaderIndex(["日期", "帳戶", "金額"], HEADER_ALIASES.amount)).toBe(2);
  });

  it("找不到回傳 -1", () => {
    expect(findHeaderIndex(["foo", "bar"], HEADER_ALIASES.date)).toBe(-1);
  });
});

describe("normalizeType", () => {
  it("英文別名", () => {
    expect(normalizeType("dividend")).toBe("dividend");
    expect(normalizeType("DIV")).toBe("dividend");
    expect(normalizeType(" interest ")).toBe("interest");
  });

  it("中文別名", () => {
    expect(normalizeType("配息")).toBe("dividend");
    expect(normalizeType("股息")).toBe("dividend");
    expect(normalizeType("利息")).toBe("interest");
    expect(normalizeType("存款利息")).toBe("interest");
  });

  it("無法辨識回傳 null", () => {
    // 原本這裡斷言 normalizeType("buy") === null。買賣匯入上線後 buy 是合法輸入，
    // 該斷言已移到下面的「買賣別名」測試，改斷言對應 adjust_quantity。
    expect(normalizeType("")).toBeNull();
    expect(normalizeType("foo")).toBeNull();
    expect(normalizeType("轉帳")).toBeNull();
  });

  it("買賣別名", () => {
    // 買進在 DB 沒有專屬 enum 值，一律對應 adjust_quantity。
    expect(normalizeType("buy")).toBe("adjust_quantity");
    expect(normalizeType("BUY")).toBe("adjust_quantity");
    expect(normalizeType("買進")).toBe("adjust_quantity");
    expect(normalizeType("加碼")).toBe("adjust_quantity");
    expect(normalizeType("sell")).toBe("sell");
    expect(normalizeType("賣出")).toBe("sell");
  });

  it("認得匯出檔寫的 enum 原文", () => {
    expect(normalizeType("adjust_quantity")).toBe("adjust_quantity");
    expect(normalizeType("adjust_balance")).toBe("adjust_balance");
    expect(normalizeType("price_update")).toBe("price_update");
    expect(normalizeType("create")).toBe("create");
    expect(normalizeType("sell")).toBe("sell");
  });
});

describe("parseAmount", () => {
  it("去除千分位逗號", () => {
    expect(parseAmount("1,200")).toBe(1200);
    expect(parseAmount("1,234,567")).toBe(1234567);
  });

  it("去除貨幣符號", () => {
    expect(parseAmount("NT$ 1200")).toBe(1200);
    expect(parseAmount("$ 50.5")).toBe(50.5);
    expect(parseAmount("￥ 100")).toBe(100);
  });

  it("純數字直接 parse", () => {
    expect(parseAmount("100")).toBe(100);
    expect(parseAmount("0.05")).toBe(0.05);
  });
});

describe("parseFlexibleDate", () => {
  it("ISO 格式", () => {
    const d = parseFlexibleDate("2025-05-01");
    expect(d).not.toBeNull();
    expect(d!.toISOString().slice(0, 10)).toBe("2025-05-01");
  });

  it("斜線格式", () => {
    const d = parseFlexibleDate("2025/5/1");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2025);
  });

  it("m/d/yyyy 格式", () => {
    const d = parseFlexibleDate("5/1/2025");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2025);
  });

  it("無效輸入回 null", () => {
    expect(parseFlexibleDate("not a date")).toBeNull();
    expect(parseFlexibleDate("")).toBeNull();
  });
});

describe("mapHeader", () => {
  it("對得上匯出檔的每一個欄位", () => {
    const cols = mapHeader(EXPORT_HEADER);
    expect(cols.date).toBe(0);
    expect(cols.account).toBe(1);
    expect(cols.type).toBe(5);
    expect(cols.quantityAfter).toBe(6);
    expect(cols.unitPrice).toBe(7);
    expect(cols.fxRate).toBe(8);
    expect(cols.valueBase).toBe(9);
    expect(cols.cashflow).toBe(10);
    expect(cols.realizedPnl).toBe(11);
    expect(cols.feeTwd).toBe(12);
    expect(cols.note).toBe(13);
  });

  it("帳戶欄優先取 account 而不是 symbol", () => {
    // account 的別名同時含 "account" 與 "symbol"，匯出檔兩欄都有。
    // 取錯會把整份檔案的帳戶比對成代號，全列查無帳戶。
    const cols = mapHeader(EXPORT_HEADER);
    expect(EXPORT_HEADER[cols.account]).toBe("account");
  });

  it("匯出檔沒有 amount 欄", () => {
    // 這正是舊版匯入讀不了自家匯出檔的原因：amount 找不到就直接整份退回。
    expect(mapHeader(EXPORT_HEADER).amount).toBe(-1);
  });

  it("手寫檔仍然對得上", () => {
    const cols = mapHeader(["日期", "帳戶", "類型", "金額", "備註"]);
    expect(cols.date).toBe(0);
    expect(cols.account).toBe(1);
    expect(cols.type).toBe(2);
    expect(cols.amount).toBe(3);
    expect(cols.note).toBe(4);
    expect(cols.cashflow).toBe(-1);
  });
});

describe("missingRequiredColumns", () => {
  it("匯出檔通過（金額由 cashflow 供應）", () => {
    expect(missingRequiredColumns(mapHeader(EXPORT_HEADER))).toEqual([]);
  });

  it("手寫檔通過（金額由 amount 供應）", () => {
    const cols = mapHeader(["date", "account", "type", "amount"]);
    expect(missingRequiredColumns(cols)).toEqual([]);
  });

  it("缺類型與金額時兩者都回報", () => {
    const missing = missingRequiredColumns(mapHeader(["date", "account"]));
    expect(missing).toHaveLength(2);
    expect(missing.join()).toContain("類型");
    expect(missing.join()).toContain("金額");
  });
});

describe("hasCostBasisColumns", () => {
  it("現行匯出檔沒有成本基礎", () => {
    expect(hasCostBasisColumns(mapHeader(EXPORT_HEADER))).toBe(false);
  });

  it("加了成本基礎欄之後為 true", () => {
    const cols = mapHeader(EXPORT_HEADER_V2);
    expect(hasCostBasisColumns(cols)).toBe(true);
    expect(cols.costBasisTwd).toBe(13);
    expect(cols.costBasisNative).toBe(14);
    expect(cols.note).toBe(15);
  });
});

describe("classifyRow", () => {
  const withCost = { hasCostBasis: true };
  const noCost = { hasCostBasis: false };
  function row(over: Partial<RowFacts>): RowFacts {
    return {
      type: "dividend",
      amountTwd: null,
      quantityAfter: null,
      valueBase: null,
      ...over,
    };
  }

  it("報價更新一律略過，不算錯", () => {
    const v = classifyRow(row({ type: "price_update" }), withCost);
    expect(v.kind).toBe("skip");
  });

  it("配息有正金額就重放", () => {
    expect(classifyRow(row({ amountTwd: 1200 }), withCost).kind).toBe("apply");
    expect(classifyRow(row({ type: "interest", amountTwd: 30 }), noCost).kind).toBe(
      "apply",
    );
  });

  it("配息金額為零或負數要退回", () => {
    expect(classifyRow(row({ amountTwd: 0 }), withCost).kind).toBe("reject");
    expect(classifyRow(row({ amountTwd: -50 }), withCost).kind).toBe("reject");
    expect(classifyRow(row({ amountTwd: null }), withCost).kind).toBe("reject");
  });

  it("沒有成本基礎欄時，部位異動列全部退回，配息不受影響", () => {
    for (const type of ["create", "adjust_quantity", "sell", "adjust_balance"] as const) {
      const v = classifyRow(row({ type, quantityAfter: 10, valueBase: 100 }), noCost);
      expect(v.kind).toBe("reject");
      expect(v.kind === "reject" && v.reason).toContain("成本基礎");
    }
    expect(classifyRow(row({ amountTwd: 1 }), noCost).kind).toBe("apply");
  });

  it("有成本基礎欄時，買賣看異動後股數", () => {
    expect(
      classifyRow(row({ type: "adjust_quantity", quantityAfter: 12.5 }), withCost).kind,
    ).toBe("apply");
    // 賣光了是合法終點，股數 0 不能當成缺值。
    expect(classifyRow(row({ type: "sell", quantityAfter: 0 }), withCost).kind).toBe(
      "apply",
    );
    expect(classifyRow(row({ type: "sell", quantityAfter: null }), withCost).kind).toBe(
      "reject",
    );
    expect(classifyRow(row({ type: "sell", quantityAfter: -1 }), withCost).kind).toBe(
      "reject",
    );
  });

  it("餘額調整看市值，不看股數", () => {
    // 手動帳戶的 quantity_after 恆為 0，狀態記在 value_after_base。
    expect(
      classifyRow(
        row({ type: "adjust_balance", quantityAfter: 0, valueBase: 50000 }),
        withCost,
      ).kind,
    ).toBe("apply");
    expect(
      classifyRow(
        row({ type: "adjust_balance", quantityAfter: 0, valueBase: null }),
        withCost,
      ).kind,
    ).toBe("reject");
  });
});
