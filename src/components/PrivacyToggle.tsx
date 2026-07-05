"use client";

import { useSyncExternalStore } from "react";

/**
 * 金額遮蔽：二態（on / off）。
 * - 存 localStorage("privacy")，寫到 <html data-privacy>，CSS 對 .amt 套 blur
 * - 與主題系統同一套機制：privacy:change event + storage event 跨分頁同步
 * - layout.tsx 的 init script 會在 first paint 前寫入 dataset，避免金額閃現
 * 遮蔽範圍：絕對金額與持有數量；百分比、日期、單價（公開行情）不遮，
 * 否則趨勢與報酬完全不可讀。
 */

type Privacy = "on" | "off";

function getSnapshot(): Privacy {
  if (typeof document === "undefined") return "off";
  return document.documentElement.dataset.privacy === "on" ? "on" : "off";
}

function getServerSnapshot(): null {
  return null;
}

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("privacy:change", callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener("privacy:change", callback);
    window.removeEventListener("storage", callback);
  };
}

export function usePrivacy(): Privacy | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function setPrivacy(next: Privacy) {
  document.documentElement.dataset.privacy = next;
  try {
    localStorage.setItem("privacy", next);
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event("privacy:change"));
}

/** Header 上的眼睛切換鈕：開眼 = 金額可見，閉眼 = 遮蔽中。 */
export function PrivacyToggle() {
  const privacy = usePrivacy();

  // SSR / hydration 前：同尺寸佔位避免 layout shift
  if (privacy === null) {
    return (
      <button
        type="button"
        aria-label="切換金額遮蔽"
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--c-muted)]"
      />
    );
  }

  const masked = privacy === "on";

  return (
    <button
      type="button"
      onClick={() => setPrivacy(masked ? "off" : "on")}
      aria-label="切換金額遮蔽"
      aria-pressed={masked}
      title={masked ? "顯示金額" : "遮蔽金額"}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-[var(--c-muted)] hover:border-[var(--c-border)] hover:bg-[var(--c-surface-soft)] hover:text-[var(--c-text)]"
    >
      {masked ? (
        // 閉眼（遮蔽中 → 點擊顯示）
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3 10c2.2 2.7 5.3 4.3 9 4.3S18.8 12.7 21 10" />
          <path d="M5.5 13.5 4 16M12 14.5V17.5M18.5 13.5 20 16" />
        </svg>
      ) : (
        // 開眼（可見 → 點擊遮蔽）
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z" />
          <circle cx="12" cy="12" r="2.7" />
        </svg>
      )}
    </button>
  );
}
