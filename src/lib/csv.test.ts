import { describe, expect, it } from "vitest";
import { escapeCsvCell } from "./csv";

describe("escapeCsvCell", () => {
  it.each(["=1+1", "+SUM(A1:A2)", "-2+3", "@cmd", "\tformula"])(
    "neutralizes spreadsheet formulas in %s",
    (value) => {
      expect(escapeCsvCell(value)).toBe(`'${value}`);
    },
  );

  it("quotes commas, line breaks, and quotes", () => {
    expect(escapeCsvCell('A, "B"\nC')).toBe('"A, ""B""\nC"');
  });

  it("preserves ordinary text and empty values", () => {
    expect(escapeCsvCell("台股帳戶")).toBe("台股帳戶");
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(undefined)).toBe("");
  });
});
