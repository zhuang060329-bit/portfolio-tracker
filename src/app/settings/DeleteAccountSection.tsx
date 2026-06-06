"use client";

import { useState } from "react";

/**
 * 刪除帳戶區（危險區，二次確認 UI）。
 *
 * 目前後端的 deleteSelfAccount server action 尚未實作 — 因為這是不可逆操作，
 * 需要：(a) 確認移除所有 RLS 綁定的資料（accounts/transactions/snapshots/...）；
 * (b) 移除 auth.users row 需用 service-role；(c) email 通知。
 *
 * 本元件僅做前端 UI（confirm 流程 + 防呆），按下「永久刪除」會 alert 提示
 * 後端尚未啟用，避免使用者誤以為已刪除而流失資料。
 */
export function DeleteAccountSection() {
  const [confirm, setConfirm] = useState(false);

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[color-mix(in_srgb,var(--c-down)_25%,transparent)] bg-[color-mix(in_srgb,var(--c-down)_6%,transparent)] p-4">
      <div className="min-w-0">
        <span className="text-[13.5px] font-semibold text-[var(--c-down)]">
          刪除帳戶
        </span>
        <span className="mt-0.5 block text-[12px] text-[var(--c-muted)]">
          永久刪除所有資料，無法復原。
        </span>
      </div>
      {confirm ? (
        <div className="flex flex-wrap items-center gap-2.5 text-[13px]">
          <span className="text-[var(--c-text)]">確定？</span>
          <button
            type="button"
            onClick={() => {
              alert(
                "刪除帳戶功能尚未啟用。要永久刪除請聯繫 admin。",
              );
            }}
            className="rounded-lg bg-[var(--c-down)] px-4 py-2 text-[13px] font-semibold text-white"
          >
            永久刪除
          </button>
          <button
            type="button"
            onClick={() => setConfirm(false)}
            className="rounded-lg border border-[var(--c-line-strong)] bg-[var(--c-surface)] px-3 py-2 text-[13px] text-[var(--c-text)]"
          >
            取消
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirm(true)}
          className="whitespace-nowrap rounded-lg border border-[color-mix(in_srgb,var(--c-down)_35%,transparent)] bg-[var(--c-surface)] px-4 py-2 text-[13px] font-medium text-[var(--c-down)] hover:bg-[color-mix(in_srgb,var(--c-down)_12%,transparent)]"
        >
          刪除帳戶
        </button>
      )}
    </div>
  );
}
