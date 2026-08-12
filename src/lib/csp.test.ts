import { afterEach, describe, expect, it } from "vitest";
import {
  buildCsp,
  createNonce,
  CSP_ENFORCE,
  CSP_REQUEST_HEADER,
  CSP_RESPONSE_HEADER,
} from "./csp";

const ORIGINAL = {
  supabase: process.env.NEXT_PUBLIC_SUPABASE_URL,
  sentry: process.env.NEXT_PUBLIC_SENTRY_DSN,
};

afterEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = ORIGINAL.supabase;
  process.env.NEXT_PUBLIC_SENTRY_DSN = ORIGINAL.sentry;
});

/** 取出某個指令的值，找不到回 null。 */
function directive(csp: string, name: string): string | null {
  for (const part of csp.split(";")) {
    const trimmed = part.trim();
    if (trimmed === name) return "";
    if (trimmed.startsWith(`${name} `)) return trimmed.slice(name.length + 1);
  }
  return null;
}

describe("buildCsp：script-src", () => {
  it("帶上這次請求的 nonce，並保留 'self'", () => {
    const value = directive(buildCsp("abc123", false), "script-src");
    expect(value).toContain("'nonce-abc123'");
    expect(value).toContain("'self'");
  });

  it("不得加入 strict-dynamic", () => {
    // 加了會讓 'self' 被忽略，而 /demo、/demo/whatif、/demo/report 的初始 HTML
    // 各有一支 Next 內部 chunk 沒帶 nonce（parser-inserted），會被擋掉，
    // 那三頁的 next/link 就失效。Report-Only 階段用瀏覽器實測確認過。
    // 這條測試是防止日後有人「照官方範例補回去」。
    expect(directive(buildCsp("abc123", false), "script-src")).not.toContain(
      "strict-dynamic",
    );
  });

  it("production 不得出現 unsafe-eval 或 unsafe-inline", () => {
    const value = directive(buildCsp("abc123", false), "script-src")!;
    expect(value).not.toContain("unsafe-eval");
    expect(value).not.toContain("unsafe-inline");
  });

  it("dev 才加 unsafe-eval（React 用 eval 重建伺服器端錯誤堆疊）", () => {
    expect(directive(buildCsp("abc123", true), "script-src")).toContain(
      "'unsafe-eval'",
    );
  });
});

describe("buildCsp：style-src", () => {
  it("必須有 unsafe-inline", () => {
    // 全站 40 幾處 style={{...}}，SSR 後是 style="..." 屬性，
    // 沒有 unsafe-inline 會整片失去顏色與版面。
    expect(directive(buildCsp("abc123", false), "style-src")).toContain(
      "'unsafe-inline'",
    );
  });

  it("絕對不能帶 nonce", () => {
    // CSP3：同一個指令裡出現 nonce 時，'unsafe-inline' 會被瀏覽器忽略。
    // 這條測試是防止日後有人「順手」把 nonce 補進 style-src 而把版面弄壞。
    expect(directive(buildCsp("abc123", false), "style-src")).not.toContain(
      "nonce",
    );
  });
});

describe("buildCsp：connect-src", () => {
  it("放行 Supabase 的 origin，去掉路徑", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://demo.supabase.co/rest/v1";
    const value = directive(buildCsp("n", false), "connect-src")!;
    expect(value).toContain("https://demo.supabase.co");
    expect(value).not.toContain("/rest/v1");
  });

  it("有 Sentry DSN 時取出 ingest origin，不外洩 key", () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN =
      "https://publickey@o123.ingest.sentry.io/456";
    const value = directive(buildCsp("n", false), "connect-src")!;
    expect(value).toContain("https://o123.ingest.sentry.io");
    expect(value).not.toContain("publickey");
    expect(value).not.toContain("/456");
  });

  it("沒設 Sentry 就不出現", () => {
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    expect(directive(buildCsp("n", false), "connect-src")).not.toContain(
      "sentry",
    );
  });

  it("壞掉的 URL 不會污染政策", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "這不是網址";
    process.env.NEXT_PUBLIC_SENTRY_DSN = "";
    expect(directive(buildCsp("n", false), "connect-src")).toBe("'self'");
  });
});

describe("buildCsp：其餘指令", () => {
  it("該有的都在", () => {
    const csp = buildCsp("n", false);
    expect(directive(csp, "default-src")).toBe("'self'");
    expect(directive(csp, "object-src")).toBe("'none'");
    expect(directive(csp, "base-uri")).toBe("'self'");
    expect(directive(csp, "form-action")).toBe("'self'");
    expect(directive(csp, "frame-ancestors")).toBe("'none'");
    expect(directive(csp, "worker-src")).toBe("'self'");
    expect(directive(csp, "font-src")).toBe("'self'");
    expect(directive(csp, "upgrade-insecure-requests")).toBe("");
  });

  it("img-src 允許 data:（MFA QR code 是 data URI）", () => {
    expect(directive(buildCsp("n", false), "img-src")).toContain("data:");
  });
});

describe("標頭名稱", () => {
  it("目前是 Report-Only", () => {
    // 翻 CSP_ENFORCE 時這兩條會一起紅，提醒確實是有意為之。
    expect(CSP_ENFORCE).toBe(false);
    expect(CSP_RESPONSE_HEADER).toBe("Content-Security-Policy-Report-Only");
  });

  it("送進 request 的標頭永遠是 Content-Security-Policy", () => {
    // Next 從 request 上的這個標頭解析 nonce。名字換掉就抓不到，
    // 翻成強制執行的那一刻整站會白。
    expect(CSP_REQUEST_HEADER).toBe("Content-Security-Policy");
  });
});

describe("createNonce", () => {
  it("每次都不一樣，且是合法的 base64 字元", () => {
    const a = createNonce();
    const b = createNonce();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(a.length).toBeGreaterThan(20);
  });
});
