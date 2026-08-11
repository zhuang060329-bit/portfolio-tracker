"use client";

import { useEffect, useRef } from "react";
import { announce, type Tone } from "./live-announcer";

/**
 * 給不走 useActionState、用 useState 存結果的畫面（登入、MFA、改密碼、刷新報價）。
 * 訊息字串一變成非空就播報。
 *
 * 已知限制：連續兩次得到「完全相同」的訊息時只會播報一次。因為 setState 設同值
 * 時 React 會跳過重繪，effect 不會再跑。畫面上那行字本來就還在，視覺行為一致。
 */
export function useAnnounceValue(
  text: string | null | undefined,
  tone: Tone = "polite",
): void {
  const prev = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (text && text !== prev.current) announce(text, tone);
    prev.current = text;
  }, [text, tone]);
}

/**
 * 全站 server action 的回傳形狀就這幾種：
 *   { error?: string }
 *   { error?: string; ok?: string }    ← ok 是成功訊息本文
 *   { error?: string; ok?: boolean }   ← ok 只表示成功，訊息要另外給
 */
export type ActionResult =
  | { error?: string | null; ok?: string | boolean }
  | null
  | undefined;

/**
 * 動作結束時播報結果。
 *
 * 只在 pending 由 true 轉 false 的那一刻播報，不是每次 state 變動都播——
 * useActionState 的 state 物件每次送出都是新參考，照 state 觸發會重複播報。
 *
 * 失敗用 assertive：使用者剛按下按鈕、正在等結果，這時打斷是他要的資訊，
 * 而且動到錢的操作失敗不能等。成功用 polite。
 *
 * @param success 成功時要唸的話。action 回傳 ok 字串時以 ok 為準；
 *                成功即導頁的表單可以不給，元件會直接卸載。
 */
export function useActionAnnounce(
  state: ActionResult,
  pending: boolean,
  success?: string,
): void {
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending) {
      const next = resolveAnnouncement(state, success);
      if (next) announce(next.text, next.tone);
    }
    wasPending.current = pending;
  }, [pending, state, success]);
}

/**
 * 決定一次動作結束後該唸什麼、用什麼語氣。抽成純函式是為了能測——
 * 這裡的優先序（error 蓋過 ok、ok 字串蓋過呼叫端給的成功句）是實際會出錯的地方。
 */
export function resolveAnnouncement(
  state: ActionResult,
  success?: string,
): { text: string; tone: Tone } | null {
  const error = state?.error;
  if (error) return { text: error, tone: "assertive" };
  const ok = state?.ok;
  // action 自己回了訊息本文就用它，那句比呼叫端寫死的成功句更貼近實際結果
  // （例如「本期已由另一個請求執行」不等於「已執行本期定期定額」）。
  const text = typeof ok === "string" ? ok : success;
  return text ? { text, tone: "polite" } : null;
}
