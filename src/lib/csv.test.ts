import { describe, expect, it } from "vitest";
import { escapeCsvCell } from "./csv";

describe("escapeCsvCell", () => {
  it("將 Excel 公式前綴轉為文字", () => {
    expect(escapeCsvCell("=SUM(1,1)")).toBe("\"'=SUM(1,1)\"");
    expect(escapeCsvCell(" +CMD()")).toBe("' +CMD()");
    expect(escapeCsvCell("@danger")).toBe("'@danger");
  });

  it("保留一般 CSV 的引號與換行轉義", () => {
    expect(escapeCsvCell('a,"b"')).toBe('"a,""b"""');
    expect(escapeCsvCell("line1\nline2")).toBe('"line1\nline2"');
    expect(escapeCsvCell("一般備註")).toBe("一般備註");
  });
});
