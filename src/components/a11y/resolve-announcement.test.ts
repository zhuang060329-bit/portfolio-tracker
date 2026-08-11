import { describe, expect, it } from "vitest";
import { resolveAnnouncement } from "./use-action-announce";

describe("resolveAnnouncement", () => {
  it("有錯誤時一律用 assertive，蓋過任何成功句", () => {
    expect(resolveAnnouncement({ error: "手續費不得大於或等於投入金額" }, "加碼已記錄")).toEqual({
      text: "手續費不得大於或等於投入金額",
      tone: "assertive",
    });
  });

  it("action 自己回的 ok 字串優先於呼叫端寫死的成功句", () => {
    // 「本期已由另一個請求執行」跟「已執行本期定期定額」是兩件事，
    // 唸錯的那句會讓使用者以為自己剛剛真的扣了一筆款。
    expect(
      resolveAnnouncement({ ok: "本期已由另一個請求執行" }, "已執行本期定期定額"),
    ).toEqual({ text: "本期已由另一個請求執行", tone: "polite" });
  });

  it("ok 是 boolean 時退回呼叫端給的成功句", () => {
    expect(resolveAnnouncement({ ok: true }, "警示已新增")).toEqual({
      text: "警示已新增",
      tone: "polite",
    });
  });

  it("成功但沒有任何可唸的句子就不播報", () => {
    // 成功即導頁的表單屬於這類，元件馬上卸載，硬唸一句反而突兀。
    expect(resolveAnnouncement({ ok: true })).toBeNull();
    expect(resolveAnnouncement(undefined)).toBeNull();
    expect(resolveAnnouncement(null)).toBeNull();
  });

  it("action 回 undefined 但呼叫端給了成功句時要唸", () => {
    // trade-actions 成功時只做 revalidatePath、不回東西，畫面自己會變，
    // 讀屏使用者沒有線索，所以這個分支必須成立。
    expect(resolveAnnouncement(undefined, "賣出已記錄")).toEqual({
      text: "賣出已記錄",
      tone: "polite",
    });
  });

  it("空字串的 error 不算錯誤，落回成功分支", () => {
    expect(resolveAnnouncement({ error: "" }, "已儲存")).toEqual({
      text: "已儲存",
      tone: "polite",
    });
  });
});
