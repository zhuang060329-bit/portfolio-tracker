"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { DemoOverviewSkeleton, DemoPageSkeleton } from "./DemoPageSkeleton";
import type { DemoActive } from "./DemoV1Header";

/* Demo 各頁的載入骨架，依路徑挑。根 loading.tsx、demo/loading.tsx、各子頁 loading.tsx
   三層 Suspense 邊界都用這一支：冷載入時先送出的是哪一層的 fallback 取決於時機
   （正式 build 實測：五個 Demo 頁的首段 HTML 都是根層已登入版 AppHeader 的骨架，
   導覽列有「帳戶、活動、基準 TWD」；/demo/report 也出現過 demo 層的總覽骨架），
   所以每一層都要依實際路徑畫出同一份骨架，換層時畫面才不會跳。
   骨架寫在 client 端而不是由 server 組好傳 props：props 會序列化進每一頁的 HTML，
   五份骨架讓 /login 的 gzip 由 8.9 KB 變 14.3 KB；寫在這裡則進可快取的 JS。 */
const PAGES: Record<string, { active: DemoActive; stats?: 3 | 4 | 5 }> = {
  decisions: { active: "decisions", stats: 3 },
  history: { active: "history", stats: 4 },
  whatif: { active: "scenario" },
  report: { active: "report", stats: 5 },
};

function demoSegment(pathname: string): string | null {
  if (pathname === "/demo") return "";
  if (pathname.startsWith("/demo/")) return pathname.split("/")[2] ?? "";
  return null;
}

export function DemoSkeletonByPath() {
  const page = PAGES[demoSegment(usePathname() ?? "") ?? ""];
  return page ? <DemoPageSkeleton active={page.active} stats={page.stats} /> : <DemoOverviewSkeleton />;
}

// 根層用：Demo 路徑換成 Demo 骨架，其他路徑原樣渲染 children
export function UnlessDemo({ children }: { children: ReactNode }) {
  return demoSegment(usePathname() ?? "") === null ? children : <DemoSkeletonByPath />;
}
