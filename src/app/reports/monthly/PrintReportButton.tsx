"use client";

import { usePrivacy } from "@/components/PrivacyToggle";

/** touchHeight：手機 44px、sm 以上 40px，跟同列改成觸控高度的月份欄位對齊。預設關，正式月報不受影響 */
export function PrintReportButton({ touchHeight = false }: { touchHeight?: boolean } = {}) {
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
          className={`btn btn-primary ${touchHeight ? "h-11 sm:h-10" : "h-10"}`}
        >
          列印／儲存 PDF
        </button>
      </div>
      <p className="print-only text-[length:var(--fs-micro)]">
        金額遮罩狀態：{privacy === "on" ? "已遮蔽" : "顯示"}
      </p>
    </>
  );
}
