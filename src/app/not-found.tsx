import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" tabIndex={-1} className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[var(--c-page)] p-6 text-center">
      <p className="font-display text-5xl font-semibold tracking-tight text-[var(--c-text)]">
        404
      </p>
      <p className="text-sm text-[var(--c-muted)]">找不到這個頁面</p>
      <Link
        href="/"
        className="btn btn-primary mt-2"
      >
        回首頁
      </Link>
    </main>
  );
}
