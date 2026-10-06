import { describe, expect, it } from "vitest";
import { fmtSignedPct, fmtSignedTwd } from "./format";

describe("fmtSignedTwd", () => {
  it("號放在幣別前，負號用 U+2212", () => {
    expect(fmtSignedTwd(13220)).toBe("+NT$ 13,220");
    expect(fmtSignedTwd(-5000)).toBe("−NT$ 5,000");
  });

  it("先取整再判號：不足 0.5 元的差額顯示 NT$ 0", () => {
    expect(fmtSignedTwd(0)).toBe("NT$ 0");
    expect(fmtSignedTwd(0.4)).toBe("NT$ 0");
    expect(fmtSignedTwd(-0.4)).toBe("NT$ 0");
    expect(fmtSignedTwd(-0.5)).toBe("NT$ 0");
  });

  it("取整後的位數與號一致", () => {
    expect(fmtSignedTwd(59.85)).toBe("+NT$ 60");
    expect(fmtSignedTwd(-0.6)).toBe("−NT$ 1");
  });
});

describe("fmtSignedPct", () => {
  it("正負號與 U+2212", () => {
    expect(fmtSignedPct(1.52)).toBe("+1.52%");
    expect(fmtSignedPct(-1.08)).toBe("−1.08%");
  });

  it("取位數後為零就不帶號", () => {
    expect(fmtSignedPct(0)).toBe("0.00%");
    expect(fmtSignedPct(-0.001)).toBe("0.00%");
    expect(fmtSignedPct(0.004)).toBe("0.00%");
  });
});
