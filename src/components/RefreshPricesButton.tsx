"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { refreshMyPrices } from "@/lib/refresh-actions";

// 手動刷新報價鈕。放在「報價更新於 …」旁邊，總覽 hero 與帳戶詳情頁共用。
// - 進行中：箭頭旋轉、不可再按
// - 結果：按鈕旁短暫顯示一行回饋（4 秒自動消失）
// - 冷卻中：顯示剩餘分鐘數（伺服器端判斷，見 refresh-actions）

export function RefreshPricesButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function flash(text: string) {
    setMsg(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 4000);
  }

  function onClick() {
    if (pending) return;
    startTransition(async () => {
      const r = await refreshMyPrices();
      if (r.ok) {
        flash(
          r.failed > 0
            ? `已更新 ${r.refreshed} 檔，${r.failed} 檔失敗`
            : `已更新 ${r.refreshed} 檔`,
        );
        router.refresh();
      } else if (r.waitSec != null) {
        flash(`剛更新過，${Math.ceil(r.waitSec / 60)} 分鐘後可再刷新`);
      } else {
        flash(`刷新失敗：${r.error}`);
      }
    });
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        aria-label="刷新報價"
        title="刷新報價"
        className="grid h-6 w-6 place-items-center rounded-[var(--r-control)] text-[var(--c-muted)] transition-colors hover:bg-[var(--c-accent-soft)] hover:text-[var(--c-accent)] disabled:pointer-events-none"
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          aria-hidden="true"
          className={pending ? "animate-spin" : ""}
        >
          <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9" />
          <path d="M13.5 1.5v3h-3" />
        </svg>
      </button>
      {msg && (
        <span
          role="status"
          className="whitespace-nowrap text-[11px] text-[var(--c-faint)]"
        >
          {msg}
        </span>
      )}
    </span>
  );
}
