import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--c-page)] p-6 text-center">
      <p className="font-serif text-5xl font-semibold tracking-tight text-[var(--c-text)]">
        404
      </p>
      <p className="text-sm text-[var(--c-muted)]">找不到這個頁面</p>
      <Link
        href="/"
        className="mt-2 rounded-sm bg-[var(--c-accent)] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
      >
        回首頁
      </Link>
    </main>
  );
}
