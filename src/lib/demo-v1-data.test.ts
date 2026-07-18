import { describe, expect, it } from "vitest";
import { buildDemoV1Data } from "./demo-v1-data";

describe("buildDemoV1Data", () => {
  it("相同日期產生完全相同的 Demo 資料", () => {
    expect(buildDemoV1Data("2026-07-18")).toEqual(
      buildDemoV1Data("2026-07-18"),
    );
  });

  it("不含真實格式的 UUID 或日期之後的快照", () => {
    const data = buildDemoV1Data("2026-07-18");
    expect(data.accounts.every((account) => account.id.startsWith("demo-"))).toBe(true);
    expect(data.snapshots.every((snapshot) => snapshot.date <= "2026-07-18")).toBe(true);
  });
});
