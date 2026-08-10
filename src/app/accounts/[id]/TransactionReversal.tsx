"use client";

import { useActionState, useState } from "react";
import { reverseTransaction } from "./reversal-actions";
import type { FormState } from "./action-shared";
import { reversalMode, type ReversalTarget } from "@/lib/transaction-reversal";

export type { ReversalTarget };

const COPY = {
  undo: {
    button: "撤銷",
    title: "撤銷這筆交易？",
    body: "會把這筆對帳戶的影響反向扣回、修正當日快照，並把這筆流水真的刪掉。若這筆來自定期定額，該期執行紀錄會一併刪除、排程日退回。已建立的投資決策若連到這筆交易，連結會被清空。",
    confirm: "確定撤銷",
  },
  reverse: {
    button: "沖銷",
    title: "沖銷這筆交易？",
    body: "原始這筆會保留，另外記一筆反向交易把帳戶狀態修正回來。已知限制：不會修正歷史快照，所以趨勢圖上這筆造成的鼓包還會留著。",
    confirm: "確定沖銷",
  },
} as const;

export function TransactionReversal({
  accountId,
  target,
}: {
  accountId: string;
  target: ReversalTarget;
}) {
  const mode = reversalMode(target);
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(
    reverseTransaction,
    undefined,
  );

  if (target.isReversal) {
    return <span className="text-[var(--c-faint)]">沖銷紀錄</span>;
  }
  if (target.alreadyReversed) {
    return <span className="text-[var(--c-faint)]">已沖銷</span>;
  }
  if (!mode) return <span className="text-[var(--c-faint)]">—</span>;

  const copy = COPY[mode];

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-11 rounded-[var(--r-control)] px-2 text-xs font-medium text-[var(--c-muted)] hover:bg-[var(--c-surface-soft)] hover:text-[var(--c-down)] sm:min-h-0 sm:py-1"
      >
        {copy.button}
      </button>
    );
  }

  return (
    <form action={action} className="flex flex-col items-start gap-2 py-1">
      <input type="hidden" name="accountId" value={accountId} />
      <input type="hidden" name="transactionId" value={target.id} />
      <input type="hidden" name="mode" value={mode} />
      <p className="text-left text-xs font-semibold text-[var(--c-text)]">
        {copy.title}
      </p>
      <p className="w-[248px] text-left text-[11px] leading-relaxed text-[var(--c-muted)]">
        {copy.body}
      </p>
      {state?.error && (
        <p
          role="alert"
          className="w-[248px] rounded-[var(--r-control)] bg-[color-mix(in_srgb,var(--c-down)_14%,transparent)] px-2 py-1.5 text-left text-[11px] leading-relaxed text-[var(--c-down)]"
        >
          {state.error}
        </p>
      )}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded-[var(--r-control)] bg-[var(--c-down)] px-3 text-xs font-semibold text-[var(--c-btn-strong-text)] disabled:opacity-50 sm:min-h-9"
        >
          {pending ? "處理中…" : copy.confirm}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="min-h-11 rounded-[var(--r-control)] border border-[var(--c-line-strong)] bg-[var(--c-surface)] px-3 text-xs text-[var(--c-text)] sm:min-h-9"
        >
          取消
        </button>
      </div>
    </form>
  );
}
