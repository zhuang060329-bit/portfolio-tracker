"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const isDemoPath = (pathname: string) => pathname === "/demo" || pathname.startsWith("/demo/");

/* 404 與錯誤頁的「回首頁」。根層 not-found.tsx 接住所有沒對上的網址（含 /demo/打錯的路徑），
   error.tsx 也包住 Demo 各頁；原本一律連到 /，未登入的 Demo 訪客會被 proxy 導去 /login。
   Demo 路徑改回 Demo 總覽，其他路徑照舊。 */
export function HomeLink({ className }: { className?: string }) {
  const demo = isDemoPath(usePathname() ?? "");
  return (
    <Link href={demo ? "/demo" : "/"} className={className}>
      {demo ? "回 Demo 總覽" : "回首頁"}
    </Link>
  );
}

// Demo 路徑換一段說明文字，其他路徑原樣渲染 children
export function DemoText({ demo, children }: { demo: ReactNode; children: ReactNode }) {
  return isDemoPath(usePathname() ?? "") ? demo : children;
}
