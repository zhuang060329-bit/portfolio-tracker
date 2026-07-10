import { describe, expect, it } from "vitest";
import { safeInternalPath } from "./safe-redirect";

describe("safeInternalPath", () => {
  it.each([
    ["/", "/"],
    ["/settings", "/settings"],
    ["/activity?type=sell#latest", "/activity?type=sell#latest"],
  ])("keeps internal path %s", (value, expected) => {
    expect(safeInternalPath(value)).toBe(expected);
  });

  it.each([
    "https://example.com",
    "//example.com",
    "/\\example.com",
    "javascript:alert(1)",
    "settings",
  ])("rejects external or ambiguous target %s", (value) => {
    expect(safeInternalPath(value)).toBe("/");
  });

  it("uses the requested fallback", () => {
    expect(safeInternalPath(null, "/login")).toBe("/login");
  });
});
