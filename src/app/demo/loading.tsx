import { DemoSkeletonByPath } from "@/components/DemoSkeleton";

// Demo 區段的載入骨架，依路徑畫出要去的那一頁（原因見 DemoSkeleton）
export default function DemoLoading() {
  return <DemoSkeletonByPath />;
}
