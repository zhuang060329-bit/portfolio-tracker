import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import {
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/alert-actions";
import { getUnreadCount } from "@/lib/notifications";

type Row = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
};

const TYPE_LABEL: Record<string, string> = {
  price_above: "價格突破",
  price_below: "價格跌破",
  allocation_drift: "配置偏離",
  system: "系統",
};

const TYPE_TONE: Record<string, string> = {
  price_above:
    "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300",
  price_below:
    "bg-rose-100 dark:bg-rose-900/50 text-rose-800 dark:text-rose-300",
  allocation_drift:
    "bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300",
  system:
    "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300",
};

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const unreadCount = await getUnreadCount();

  const { data } = await supabase
    .from("notifications")
    .select("id,type,title,body,read_at,created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = (data ?? []) as Row[];
  const unreadInList = rows.filter((r) => !r.read_at).length;

  return (
    <div className="min-h-screen bg-[var(--c-page)] text-[var(--c-text)]">
      <AppHeader active={null} userEmail={user?.email} unreadCount={unreadCount} />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="mb-4 text-sm">
          <Link href="/" className="text-[var(--c-muted)] hover:text-[var(--c-text)]">
            ← 回總覽
          </Link>
        </div>
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl font-semibold tracking-tight">
              通知
            </h1>
            <p className="mt-2 text-sm text-[var(--c-muted)]">
              警示觸發紀錄，最近 200 筆。
              {unreadInList > 0 && (
                <span className="ml-2 text-[var(--c-text)]">
                  · 未讀 {unreadInList}
                </span>
              )}
            </p>
          </div>
          {unreadInList > 0 && (
            <form action={markAllNotificationsRead}>
              <button
                type="submit"
                className="rounded-sm border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-1.5 text-xs text-[var(--c-text)] hover:bg-[var(--c-surface-soft)]"
              >
                全部標為已讀
              </button>
            </form>
          )}
        </header>

        {rows.length === 0 ? (
          <div className="mt-6 rounded-md border border-dashed border-[var(--c-border)] bg-[var(--c-surface)] px-6 py-12 text-center">
            <p className="text-sm text-[var(--c-muted)]">
              還沒有任何通知。先到{" "}
              <Link
                href="/alerts"
                className="text-[var(--c-accent)] underline"
              >
                警示設定
              </Link>
              {" "}建立警示。
            </p>
          </div>
        ) : (
          <ul className="mt-6 flex flex-col gap-2">
            {rows.map((r) => (
              <li
                key={r.id}
                className={`rounded-md border border-[var(--c-border)] bg-[var(--c-surface)] p-4 shadow-sm ${
                  r.read_at ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex rounded-sm px-2 py-0.5 text-[10px] ${
                          TYPE_TONE[r.type] ?? TYPE_TONE.system
                        }`}
                      >
                        {TYPE_LABEL[r.type] ?? r.type}
                      </span>
                      <span className="text-sm font-medium">{r.title}</span>
                      {!r.read_at && (
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--c-accent)]" />
                      )}
                    </div>
                    {r.body && (
                      <p className="mt-1 whitespace-pre-line text-xs text-[var(--c-muted)]">
                        {r.body}
                      </p>
                    )}
                    <p className="mt-1 text-[10px] text-[var(--c-faint)]">
                      {fmtTime(r.created_at)}
                    </p>
                  </div>
                  {!r.read_at && (
                    <form action={markNotificationRead} className="contents">
                      <input type="hidden" name="id" value={r.id} />
                      <button
                        type="submit"
                        className="shrink-0 rounded-sm border border-[var(--c-border)] bg-[var(--c-surface)] px-2 py-1 text-[10px] text-[var(--c-muted)] hover:bg-[var(--c-surface-soft)]"
                      >
                        標為已讀
                      </button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
