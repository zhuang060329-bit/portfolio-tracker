"use client";

import { useActionState, useState } from "react";
import { deleteMyAccount, type FormState } from "@/lib/profile-actions";
import { useActionAnnounce } from "@/components/a11y/use-action-announce";

/**
 * 刪除帳戶區（危險區）。
 *
 * 二次確認用「手打自己的 email」而不是單純再按一次按鈕：這是不可逆且會連鎖
 * 清掉所有資料的操作，按鈕連點防不了誤觸。email 比對在 server action 內做，
 * 這裡的 matched 只用來決定按鈕是否可按。
 */
export function DeleteAccountSection({ email }: { email: string | null }) {
  const [confirm, setConfirm] = useState(false);
  const [typed, setTyped] = useState("");
  const [state, action, pending] = useActionState<FormState, FormData>(
    deleteMyAccount,
    undefined,
  );
  // 成功會 signOut 後導去 /login，所以只播報失敗。
  useActionAnnounce(state, pending);

  const matched =
    email !== null && typed.trim().toLowerCase() === email.toLowerCase();

  return (
    <div className="mt-4 rounded-xl border border-[color-mix(in_srgb,var(--c-down)_25%,transparent)] bg-[color-mix(in_srgb,var(--c-down)_6%,transparent)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <span className="text-[13.5px] font-semibold text-[var(--c-down)]">
            刪除帳戶
          </span>
          <span className="mt-0.5 block text-[12px] text-[var(--c-muted)]">
            永久刪除所有資料，無法復原。
          </span>
        </div>
        {!confirm && (
          <button
            type="button"
            onClick={() => setConfirm(true)}
            className="min-h-11 whitespace-nowrap rounded-lg border border-[color-mix(in_srgb,var(--c-down)_35%,transparent)] bg-[var(--c-surface)] px-4 text-[13px] font-medium text-[var(--c-down)] hover:bg-[color-mix(in_srgb,var(--c-down)_12%,transparent)]"
          >
            刪除帳戶
          </button>
        )}
      </div>

      {confirm && (
        <form
          action={action}
          className="mt-4 border-t border-[color-mix(in_srgb,var(--c-down)_20%,transparent)] pt-4"
        >
          <p className="text-[12.5px] leading-relaxed text-[var(--c-text)]">
            送出後會立刻刪除下列全部資料，且沒有回收桶：
          </p>
          <ul className="mt-2 space-y-1 text-[12px] leading-relaxed text-[var(--c-muted)]">
            <li>帳戶與持倉、所有交易紀錄、每日淨值快照</li>
            <li>投資決策與覆盤紀錄</li>
            <li>定期定額計劃與執行紀錄</li>
            <li>警示規則與通知</li>
            <li>個人設定（配置目標、集中度上限）與登入身分</li>
          </ul>
          <p className="mt-2 text-[12px] leading-relaxed text-[var(--c-muted)]">
            想留底的話，先用上方的「匯出全部資料」下載一份 CSV。
          </p>

          <label className="mt-4 block text-[12.5px] font-medium text-[var(--c-text)]">
            輸入
            <span className="mx-1 font-semibold text-[var(--c-down)]">
              {email ?? "（此帳號沒有 email）"}
            </span>
            以確認
            <input
              name="confirmEmail"
              type="email"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              className="mt-1.5 h-11 w-full max-w-sm rounded-lg border border-[var(--c-border)] bg-[var(--c-surface)] px-3 text-[13.5px] font-normal text-[var(--c-text)] outline-none focus:border-[color-mix(in_srgb,var(--c-down)_50%,transparent)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--c-down)_18%,transparent)]"
            />
          </label>

          {state?.error && (
            <p className="mt-3 rounded-lg bg-[color-mix(in_srgb,var(--c-down)_14%,transparent)] px-3 py-2 text-[12px] text-[var(--c-down)]">
              {state.error}
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <button
              type="submit"
              disabled={pending || !matched}
              className="min-h-11 rounded-lg bg-[var(--c-down)] px-4 text-[13px] font-semibold text-[var(--c-btn-strong-text)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "刪除中…" : "永久刪除我的帳戶"}
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirm(false);
                setTyped("");
              }}
              className="min-h-11 rounded-lg border border-[var(--c-line-strong)] bg-[var(--c-surface)] px-4 text-[13px] text-[var(--c-text)]"
            >
              取消
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
