"use client";

import { useActionState, useState } from "react";
import { deleteUser, type FormState } from "@/lib/allowlist-actions";

export type UserRow = {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  confirmed: boolean;
};

const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("zh-TW", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

function DeleteButton({
  userId,
  email,
  isSelf,
}: {
  userId: string;
  email: string;
  isSelf: boolean;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    deleteUser,
    undefined,
  );
  const [confirm, setConfirm] = useState(false);

  if (isSelf) {
    return (
      <span className="text-[10px] text-[var(--c-faint)]">（你自己）</span>
    );
  }

  if (!confirm) {
    return (
      <button
        type="button"
        onClick={() => setConfirm(true)}
        className="text-xs text-[var(--c-muted)] underline hover:text-[var(--c-down)]"
      >
        踢出
      </button>
    );
  }

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <span className="text-xs text-[var(--c-muted)]">
        確定踢出 <b>{email}</b> 並刪除所有資料？
      </span>
      <button
        type="submit"
        disabled={pending}
        className="rounded-[var(--r-control)] bg-[var(--c-down)] px-2 py-1 text-xs font-medium text-[var(--c-btn-strong-text)] hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "刪除中…" : "確定"}
      </button>
      <button
        type="button"
        onClick={() => setConfirm(false)}
        className="rounded-[var(--r-control)] border border-[var(--c-border)] bg-[var(--c-surface)] px-2 py-1 text-xs text-[var(--c-text)]"
      >
        取消
      </button>
      {state?.error && (
        <span className="text-xs text-[var(--c-down)]">
          {state.error}
        </span>
      )}
    </form>
  );
}

export function UsersManager({
  rows,
  currentUserId,
}: {
  rows: UserRow[];
  currentUserId: string;
}) {
  return (
    <div className="rounded-[var(--r-card)] border border-[var(--c-border)] bg-[var(--c-surface)] shadow-[var(--c-shadow)]">
      <div className="flex items-center justify-between border-b border-[var(--c-border)] px-5 py-3">
        <h2 className="font-serif text-lg font-semibold tracking-tight">
          已註冊使用者
        </h2>
        <span className="text-xs text-[var(--c-muted)]">共 {rows.length} 人</span>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-[var(--c-muted)]">
          還沒有人註冊。
        </p>
      ) : (
        <ul className="divide-y divide-[var(--c-border-soft)]">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-[var(--c-text)]">
                    {r.email}
                  </span>
                  {!r.confirmed && (
                    <span className="rounded bg-[color-mix(in_srgb,var(--c-down)_12%,transparent)] border border-[color-mix(in_srgb,var(--c-down)_25%,transparent)] px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[var(--c-down)]">
                      未驗證
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-xs text-[var(--c-muted)]">
                  註冊 {fmtDate(r.created_at)}
                  <span className="mx-2 text-[var(--c-faint)]">·</span>
                  上次登入 {fmtDate(r.last_sign_in_at)}
                </div>
              </div>
              <DeleteButton
                userId={r.id}
                email={r.email}
                isSelf={r.id === currentUserId}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
