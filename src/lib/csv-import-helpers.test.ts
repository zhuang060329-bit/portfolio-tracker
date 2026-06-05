import { describe, expect, it } from "vitest";
import {
  findHeaderIndex,
  HEADER_ALIASES,
  normalizeType,
  parseAmount,
  parseFlexibleDate,
} from "./csv-import-helpers";

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
    expect(normalizeType("buy")).toBeNull();
    expect(normalizeType("")).toBeNull();
    expect(normalizeType("foo")).toBeNull();
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
