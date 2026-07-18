"use client";

import { usePrivacy } from "@/components/PrivacyToggle";

export function PrintReportButton() {
  const privacy = usePrivacy();
  return (
    <>
      <div className="no-print flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={() => window.print()}
          className="h-10 rounded-[var(--r-control)] bg-[var(--c-accent)] px-4 text-[13px] font-semibold text-[var(--c-btn-strong-text)] hover:brightness-110"
        >
          列印／儲存 PDF
        </button>
        <span className="text-[10.5px] text-[var(--c-muted)]">
          列印時金額：{privacy === "on" ? "已遮蔽" : "顯示"}
        </span>
      </div>
      <p className="print-only text-[10px]">
        金額遮罩狀態：{privacy === "on" ? "已遮蔽" : "顯示"}
      </p>
    </>
  );
}
