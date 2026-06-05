import { describe, expect, it } from "vitest";

// 純函式版本的 FX/Market PnL 拆解（與 page.tsx 內的算法一致）
// 公式：
//   avg_cost_fx = cost_basis_twd / cost_basis_native
//   avg_cost_native_per_unit = cost_basis_native / quantity
//   marketPnl = quantity × (current_price - avg_cost_native_per_unit) × avg_cost_fx
//   fxPnl     = quantity × current_price × (current_fx - avg_cost_fx)
//   totalPnl  = quantity × current_price × current_fx - cost_basis_twd
// 期望：marketPnl + fxPnl ≈ totalPnl

function splitPnl(args: {
  quantity: number;
  costBasisTwd: number;
  costBasisNative: number;
  currentPrice: number;
  currentFx: number;
}) {
  const avgFx = args.costBasisTwd / args.costBasisNative;
  const avgNative = args.costBasisNative / args.quantity;
  const marketPnl =
    args.quantity * (args.currentPrice - avgNative) * avgFx;
  const fxPnl =
    args.quantity * args.currentPrice * (args.currentFx - avgFx);
  const totalPnl =
    args.quantity * args.currentPrice * args.currentFx - args.costBasisTwd;
  return { marketPnl, fxPnl, totalPnl };
}

describe("FX/Market PnL split", () => {
  it("拆解相加應等於總 PnL（誤差在 0.01 內）", () => {
    // 第一筆：1 股 @ $100, fx=30 → 3000 TWD
    // 第二筆：1 股 @ $110, fx=32 → 3520 TWD
    // 累計：cost_native = 210 USD, cost_twd = 6520
    // 現在：2 股 × $120 × fx=31 = 7440 TWD
    const r = splitPnl({
      quantity: 2,
      costBasisTwd: 6520,
      costBasisNative: 210,
      currentPrice: 120,
      currentFx: 31,
    });
    expect(r.marketPnl + r.fxPnl).toBeCloseTo(r.totalPnl, 2);
    // 平均 cost fx ≈ 31.05；現在 31 → fx 略為負；標的漲 → market 正
    expect(r.marketPnl).toBeGreaterThan(0);
    expect(r.fxPnl).toBeLessThan(0);
  });

  it("FX 不變時，全部 PnL = market PnL", () => {
    const r = splitPnl({
      quantity: 1,
      costBasisTwd: 3000,
      costBasisNative: 100,
      currentPrice: 110,
      currentFx: 30, // 同 avg
    });
    expect(r.fxPnl).toBeCloseTo(0, 2);
    expect(r.marketPnl).toBeCloseTo(r.totalPnl, 2);
  });

  it("價格不變時，全部 PnL = fx PnL", () => {
    const r = splitPnl({
      quantity: 1,
      costBasisTwd: 3000,
      costBasisNative: 100,
      currentPrice: 100, // 同 avg
      currentFx: 31,
    });
    expect(r.marketPnl).toBeCloseTo(0, 2);
    expect(r.fxPnl).toBeCloseTo(r.totalPnl, 2);
  });
});

// 平均成本法的賣出損益
function sellAlloc(args: {
  oldQty: number;
  oldCostTwd: number;
  oldCostNative: number;
  sellQty: number;
  proceedsTwd: number;
}) {
  const ratio = args.sellQty / args.oldQty;
  const allocCost = args.oldCostTwd * ratio;
  const realized = args.proceedsTwd - allocCost;
  return {
    realized,
    newQty: args.oldQty - args.sellQty,
    newCostTwd: args.oldCostTwd - allocCost,
    newCostNative: args.oldCostNative * (1 - ratio),
  };
}

describe("平均成本法賣出", () => {
  it("半倉賣出，成本 / 數量 / 原幣成本都減半", () => {
    const r = sellAlloc({
      oldQty: 10,
      oldCostTwd: 30000,
      oldCostNative: 1000,
      sellQty: 5,
      proceedsTwd: 20000,
    });
    expect(r.newQty).toBe(5);
    expect(r.newCostTwd).toBe(15000);
    expect(r.newCostNative).toBe(500);
    expect(r.realized).toBe(5000); // 20000 - 15000
  });

  it("全部賣出，剩 0", () => {
    const r = sellAlloc({
      oldQty: 2,
      oldCostTwd: 6000,
      oldCostNative: 200,
      sellQty: 2,
      proceedsTwd: 8000,
    });
    expect(r.newQty).toBe(0);
    expect(r.newCostTwd).toBe(0);
    expect(r.newCostNative).toBe(0);
    expect(r.realized).toBe(2000);
  });

  it("賠錢賣，realized 為負", () => {
    const r = sellAlloc({
      oldQty: 1,
      oldCostTwd: 1000,
      oldCostNative: 100,
      sellQty: 1,
      proceedsTwd: 700,
    });
    expect(r.realized).toBe(-300);
  });
});
