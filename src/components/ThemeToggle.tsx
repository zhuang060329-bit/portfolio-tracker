"use client";

import { useSyncExternalStore } from "react";

// 用 useSyncExternalStore 訂閱 document.documentElement.dataset.theme，
// 滿足 React 19 的 react-hooks/set-state-in-effect 規則，
// 同時透過 dispatch storage event 在同分頁內觸發 re-render。
// FOUC 預防仍由 layout.tsx 的內聯 script 處理（在 React hydrate 之前就把 theme 設好）。

function getSnapshot(): "light" | "dark" {
  if (typeof document === "undefined") return "light";
  return (
    (document.documentElement.dataset.theme as "light" | "dark") || "light"
  );
}

function getServerSnapshot(): null {
  return null;
}

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("theme:change", callback);
  window.addEventListener("storage", callback); // 跨分頁同步
  return () => {
    window.removeEventListener("theme:change", callback);
    window.removeEventListener("storage", callback);
  };
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function toggle() {
    const next = (theme ?? "light") === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      // ignore
    }
    window.dispatchEvent(new Event("theme:change"));
  }

  // SSR / hydration 前：渲染同尺寸佔位避免 layout shift
  if (theme === null) {
    return (
      <button
        type="button"
        aria-label="Toggle theme"
        className="flex h-8 w-8 items-center justify-center rounded-sm border border-[var(--c-border)] bg-[var(--c-surface)] text-xs"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle theme"
      title={theme === "dark" ? "切到淺色" : "切到暗色"}
      className="flex h-8 w-8 items-center justify-center rounded-sm border border-[var(--c-border)] bg-[var(--c-surface)] text-sm text-[var(--c-text)] hover:bg-[var(--c-page)]"
    >
      {theme === "dark" ? "☀" : "☾"}
    </button>
  );
}
