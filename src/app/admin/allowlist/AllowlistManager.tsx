"use client";

import { useActionState } from "react";
import {
  addAllowedEmail,
  removeAllowedEmail,
  type FormState,
} from "@/lib/allowlist-actions";

export type Row = {
  email: string;
  note: string | null;
  added_at: string;
};

function RemoveButton({ email }: { email: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    removeAllowedEmail,
    undefined,
  );
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="email" value={email} />
      <button
        type="submit"
        disabled={pending}
        className="text-xs text-[var(--c-muted)] underline hover:text-red-700 dark:hover:text-red-400 disabled:opacity-50"
      >
        {pending ? "刪除中…" : "刪除"}
      </button>
      {state?.error && (
        <span className="text-xs text-red-700 dark:text-red-300">
          {state.error}
        </span>
      )}
    </form>
  );
}

export function AllowlistManager({ rows }: { rows: Row[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    addAllowedEmail,
    undefined,
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Add form */}
      <form
        action={action}
        className="flex flex-col gap-3 rounded-md border border-[var(--c-border)] bg-[var(--c-surface)] p-5 shadow-sm"
      >
        <h2 className="font-serif text-lg font-semibold tracking-tight">
          新增 email
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr]">
          <label className="flex flex-col gap-1 text-xs text-[var(--c-muted)]">
            Email
            <input
              name="email"
              type="email"
              required
              placeholder="friend@example.com"
              className="rounded border border-[var(--c-border)] px-3 py-2 text-sm text-[var(--c-text)]"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-[var(--c-muted)]">
            備註（選填）
            <input
              name="note"
              type="text"
              placeholder="王小明 - 朋友"
              className="rounded border border-[var(--c-border)] px-3 py-2 text-sm text-[var(--c-text)]"
            />
          </label>
        </div>
        {state?.error && (
          <p className="rounded bg-red-50 dark:bg-red-950/40 px-2 py-1 text-xs text-red-700 dark:text-red-300">
            {state.error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="self-start rounded-sm bg-[var(--c-accent)] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "新增中…" : "加入名單"}
        </button>
      </form>

      {/* List */}
      <div className="rounded-md border border-[var(--c-border)] bg-[var(--c-surface)] shadow-sm">
        <div className="flex items-center justify-between border-b border-[var(--c-border)] px-5 py-3">
          <h2 className="font-serif text-lg font-semibold tracking-tight">
            目前名單
          </h2>
          <span className="text-xs text-[var(--c-muted)]">
            共 {rows.length} 人
          </span>
        </div>
        {rows.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-[var(--c-muted)]">
            還沒有人，從上面表單新增第一個 email。
          </p>
        ) : (
          <ul className="divide-y divide-[var(--c-border-soft)]">
            {rows.map((r) => (
              <li
                key={r.email}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-[var(--c-text)]">
                    {r.email}
                  </div>
                  <div className="mt-0.5 text-xs text-[var(--c-muted)]">
                    {r.note ?? "（無備註）"}
                    <span className="mx-2 text-[var(--c-faint)]">·</span>
                    {new Date(r.added_at).toLocaleDateString("en-CA")}
                  </div>
                </div>
                <RemoveButton email={r.email} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
