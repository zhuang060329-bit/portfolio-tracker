import { describe, expect, it } from "vitest";
import {
  DecisionReviewSchema,
  InvestmentDecisionSchema,
  parseDecisionTags,
} from "./investment-decision";

const validDecision = {
  accountId: "",
  transactionId: "",
  decisionDate: "2026-07-18",
  assetName: "台灣加權指數",
  symbol: "",
  decisionType: "buy",
  thesis: "企業獲利成長可支持目前估值。",
  catalysts: "",
  risks: "獲利下修。",
  invalidationConditions: "連續兩季獲利年減。",
  expectedHoldingMonths: "24",
  targetReturnMinPct: "10",
  targetReturnMaxPct: "20",
  maxDrawdownPct: "15",
  confidence: "2",
  reviewDate: "2027-01-18",
  tags: "長期, 指數",
};

describe("InvestmentDecisionSchema", () => {
  it("解析完整決策並把空白關聯轉為 undefined", () => {
    const result = InvestmentDecisionSchema.parse(validDecision);
    expect(result.accountId).toBeUndefined();
    expect(result.expectedHoldingMonths).toBe(24);
    expect(result.targetReturnMinPct).toBe(10);
  });

  it("拒絕早於決策日的檢討日期", () => {
    const result = InvestmentDecisionSchema.safeParse({
      ...validDecision,
      reviewDate: "2026-07-17",
    });
    expect(result.success).toBe(false);
  });

  it("拒絕上下限顛倒與超過 12 個標籤", () => {
    const result = InvestmentDecisionSchema.safeParse({
      ...validDecision,
      targetReturnMinPct: "30",
      targetReturnMaxPct: "10",
      tags: Array.from({ length: 13 }, (_, index) => `標籤${index}`).join(","),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toEqual(
        expect.arrayContaining(["最高目標報酬不可低於最低值", "標籤最多 12 個"]),
      );
    }
  });
});

describe("DecisionReviewSchema", () => {
  it("保留流程評分，並把是否依計畫執行轉成布林值", () => {
    const result = DecisionReviewSchema.parse({
      hypothesisOutcome: "假設部分成立。",
      catalystOutcome: "",
      riskOutcome: "",
      planFollowed: "false",
      decisionQuality: "2",
      reflection: "進場前證據不足。",
      nextImprovement: "增加估值檢核。",
    });
    expect(result.planFollowed).toBe(false);
    expect(result.decisionQuality).toBe(2);
  });
});

describe("parseDecisionTags", () => {
  it("支援中英文逗號並移除重複標籤", () => {
    expect(parseDecisionTags("長期, 指數，長期")).toEqual(["長期", "指數"]);
  });
});
