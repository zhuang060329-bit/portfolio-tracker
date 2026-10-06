import { AUTH_MAIN, AuthCard } from "@/components/AuthCard";
import { DemoText, HomeLink } from "@/components/HomeLink";

export default function NotFound() {
  return (
    <main id="main" tabIndex={-1} className={AUTH_MAIN}>
      <AuthCard
        label={<span className="tnum">404</span>}
        title="找不到這個頁面"
        sub={
          // Demo 是固定的示範資料，沒有「被刪除」這回事
          <DemoText demo="Demo 沒有這一頁，網址可能打錯了。">網址可能打錯，或這筆資料已經刪除。</DemoText>
        }
      >
        <HomeLink className="btn btn-primary btn-lg mt-6 w-full" />
      </AuthCard>
    </main>
  );
}
