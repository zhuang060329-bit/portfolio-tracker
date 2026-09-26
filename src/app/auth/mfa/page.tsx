import { Suspense } from "react";
import { MfaVerifyForm } from "./MfaVerifyForm";
import { AUTH_MAIN, AuthCard } from "@/components/AuthCard";

export default function MfaVerifyPage() {
  return (
    <main id="main" tabIndex={-1} className={AUTH_MAIN}>
      <Suspense
        fallback={
          <AuthCard label="二階段驗證" title="驗證碼" sub="讀取中…" />
        }
      >
        <MfaVerifyForm />
      </Suspense>
    </main>
  );
}
