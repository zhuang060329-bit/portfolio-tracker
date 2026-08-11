import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  announce,
  getServerSnapshot,
  getSnapshot,
  resetAnnouncer,
  subscribe,
} from "./live-announcer";

describe("live-announcer", () => {
  beforeEach(() => {
    resetAnnouncer();
  });

  it("播報後文字進到其中一格 polite region", () => {
    announce("配置目標已儲存");
    const s = getSnapshot();
    expect([s.politeA, s.politeB]).toContain("配置目標已儲存");
    // assertive 不受影響
    expect(s.assertiveA).toBe("");
    expect(s.assertiveB).toBe("");
  });

  it("連續兩次相同訊息會落在不同格，第二次才會被唸到", () => {
    // 螢幕閱讀器只在內容改變時播報。兩次都寫同一格的話，第二次沒有變化，
    // 使用者聽不到——連按兩次刷新都回「冷卻中」就是這個情境。
    announce("剛更新過，3 分鐘後可再刷新");
    const first = getSnapshot();
    announce("剛更新過，3 分鐘後可再刷新");
    const second = getSnapshot();

    const firstSlot = first.politeA ? "A" : "B";
    const secondSlot = second.politeA ? "A" : "B";
    expect(secondSlot).not.toBe(firstSlot);
    // 舊那格要被清空，否則兩格同時有字會被唸兩次
    if (secondSlot === "A") expect(second.politeB).toBe("");
    else expect(second.politeA).toBe("");
  });

  it("polite 與 assertive 各自獨立輪替", () => {
    announce("已更新 3 檔", "polite");
    announce("刷新失敗：抓價逾時", "assertive");
    const s = getSnapshot();
    expect([s.politeA, s.politeB]).toContain("已更新 3 檔");
    expect([s.assertiveA, s.assertiveB]).toContain("刷新失敗：抓價逾時");
  });

  it("空字串與純空白不播報，避免無意義的中斷", () => {
    announce("   ");
    announce("");
    expect(getSnapshot()).toEqual(getServerSnapshot());
  });

  it("訊息前後空白會被修掉", () => {
    announce("  已撤銷這筆交易  ");
    const s = getSnapshot();
    expect([s.politeA, s.politeB]).toContain("已撤銷這筆交易");
  });

  it("訂閱者會收到通知，退訂後不再收到", () => {
    const seen = vi.fn();
    const off = subscribe(seen);
    announce("加碼已記錄");
    expect(seen).toHaveBeenCalledTimes(1);
    off();
    announce("賣出已記錄");
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it("沒有播報時 snapshot 參考穩定，不會讓 useSyncExternalStore 無限重繪", () => {
    const a = getSnapshot();
    const b = getSnapshot();
    expect(a).toBe(b);
    announce("配置目標已儲存");
    expect(getSnapshot()).not.toBe(a);
  });

  it("SSR snapshot 永遠是空的，避免 hydration 不一致", () => {
    announce("這句只存在於 client");
    expect(getServerSnapshot()).toEqual({
      politeA: "",
      politeB: "",
      assertiveA: "",
      assertiveB: "",
    });
  });
});
