import { Suspense } from "react";
import { MfaVerifyForm } from "./MfaVerifyForm";

export default function MfaVerifyPage() {
  return (
    <main id="main" tabIndex={-1} className="flex min-h-dvh flex-col items-center justify-center bg-[var(--c-page)] p-6">
      <Suspense
        fallback={
          <div className="w-full max-w-sm rounded-md border border-[var(--c-border)] bg-[var(--c-surface)] p-8 text-sm text-[var(--c-muted)] shadow-sm">
            讀取中…
          </div>
        }
      >
        <MfaVerifyForm />
      </Suspense>
    </main>
  );
}
