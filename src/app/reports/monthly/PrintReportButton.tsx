"use client";

import { usePrivacy } from "@/components/PrivacyToggle";

export function PrintReportButton() {
  const privacy = usePrivacy();
  return (
    <>
      {/* 狀態字放在按鈕上方，跟旁邊表單「月份」那個欄位標籤同一個位置與字級。
          原本放在按鈕下方，父層 items-end 以整塊底邊對齊，按鈕因此比「產生」高出一行字。 */}
      <div className="no-print flex flex-col items-end gap-1">
        <span className="text-[length:var(--fs-micro)] text-[var(--c-muted)]">
          列印時金額：{privacy === "on" ? "已遮蔽" : "顯示"}
        </span>
        <button
          type="button"
          onClick={() => window.print()}
          className="btn btn-primary h-10"
        >
          列印／儲存 PDF
        </button>
      </div>
      <p className="print-only text-xs">
        金額遮罩狀態：{privacy === "on" ? "已遮蔽" : "顯示"}
      </p>
    </>
  );
}
