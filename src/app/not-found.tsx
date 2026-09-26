import Link from "next/link";
import { AUTH_MAIN, AuthCard } from "@/components/AuthCard";

export default function NotFound() {
  return (
    <main id="main" tabIndex={-1} className={AUTH_MAIN}>
      <AuthCard
        label={<span className="tnum">404</span>}
        title="找不到這個頁面"
        sub="網址可能打錯，或這筆資料已經刪除。"
      >
        <Link href="/" className="btn btn-primary btn-lg mt-6 w-full">
          回首頁
        </Link>
      </AuthCard>
    </main>
  );
}
