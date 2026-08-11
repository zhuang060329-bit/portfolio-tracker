/**
 * 全站唯一的螢幕閱讀器播報中心。
 *
 * 為什麼不是在每個訊息元素上直接掛 aria-live：
 *
 * 1. 條件渲染的 live region 常常不會被唸。`{err && <p aria-live="polite">}`
 *    是把 region 連同內容一起插進 DOM，而多數螢幕閱讀器只在「已經存在於
 *    無障礙樹裡的 region 內容改變」時才播報。region 必須先在場。
 * 2. 改成常駐容器會動到版面。這些訊息多半位於 flex gap 容器內，永遠存在的
 *    空元素會多吃一個 gap，20 個檔案都有風險。
 *
 * 所以視覺標記完全不動，改由 layout 掛一個常駐的隱藏 region，動作結束時把
 * 文字推進來。播報與畫面呈現徹底分離。
 */

export type Tone = "polite" | "assertive";

export type AnnouncerSnapshot = {
  politeA: string;
  politeB: string;
  assertiveA: string;
  assertiveB: string;
};

const EMPTY: AnnouncerSnapshot = {
  politeA: "",
  politeB: "",
  assertiveA: "",
  assertiveB: "",
};

let snapshot: AnnouncerSnapshot = EMPTY;
let politeFlip = false;
let assertiveFlip = false;
const listeners = new Set<() => void>();

/**
 * 每個語氣配兩個 region、輪流寫入。
 *
 * 螢幕閱讀器只在內容「改變」時播報，所以連按兩次刷新、兩次都回「冷卻中」的話，
 * 寫進同一個 region 等於沒有變化，第二次不會唸。輪流寫入可以讓第二次落在另一個
 * region，那一格是從空字串變成文字，確實構成變化。
 */
export function announce(text: string, tone: Tone = "polite"): void {
  const t = text.trim();
  if (!t) return;
  if (tone === "assertive") {
    assertiveFlip = !assertiveFlip;
    snapshot = {
      ...snapshot,
      assertiveA: assertiveFlip ? t : "",
      assertiveB: assertiveFlip ? "" : t,
    };
  } else {
    politeFlip = !politeFlip;
    snapshot = {
      ...snapshot,
      politeA: politeFlip ? t : "",
      politeB: politeFlip ? "" : t,
    };
  }
  for (const l of listeners) l();
}

export function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export function getSnapshot(): AnnouncerSnapshot {
  return snapshot;
}

/** SSR 時沒有任何待播報訊息，回固定物件避免 hydration 不一致。 */
export function getServerSnapshot(): AnnouncerSnapshot {
  return EMPTY;
}

/** 測試用：把模組狀態歸零。 */
export function resetAnnouncer(): void {
  snapshot = EMPTY;
  politeFlip = false;
  assertiveFlip = false;
  listeners.clear();
}
