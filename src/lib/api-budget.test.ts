import { describe, expect, it } from "vitest";
import { ApiBudgetExceededError, parseBudget } from "./api-budget";

describe("parseBudget", () => {
  it("未設定或空字串時用預設值", () => {
    expect(parseBudget(undefined)).toBe(500);
    expect(parseBudget("")).toBe(500);
    expect(parseBudget("   ")).toBe(500);
  });

  it("正常整數照用", () => {
    expect(parseBudget("800")).toBe(800);
    expect(parseBudget("0")).toBe(0);
  });

  it("設定錯誤時退回預設值，不是關掉守門", () => {
    // 打錯字讓上限變成 Infinity 或 NaN 等於整道關卡失效，
    // 而且不會有人發現。寧可退回保守預設值。
    expect(parseBudget("abc")).toBe(500);
    expect(parseBudget("-1")).toBe(500);
    expect(parseBudget("12.5")).toBe(500);
    expect(parseBudget("Infinity")).toBe(500);
  });

  it("0 是有效設定，代表完全關閉該來源", () => {
    // 與「設定錯誤」要分得開：明確填 0 是使用者的意思。
    expect(parseBudget("0")).toBe(0);
  });
});

describe("ApiBudgetExceededError", () => {
  it("訊息是給使用者看的中文，且帶得出是哪個來源", () => {
    const e = new ApiBudgetExceededError("twelvedata");
    expect(e.provider).toBe("twelvedata");
    expect(e.message).toContain("美股報價");
    expect(e.message).toContain("額度");
    expect(e).toBeInstanceOf(Error);
  });

  it("三個來源都有自己的中文標籤", () => {
    expect(new ApiBudgetExceededError("finmind").message).toContain("台股報價");
    expect(new ApiBudgetExceededError("coingecko").message).toContain("加密報價");
  });
});
