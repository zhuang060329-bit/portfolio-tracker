"use client";

import { useActionState, useState } from "react";
import {
  addByAmount,
  adjustBalance,
  adjustQuantity,
  archiveAccount,
  deleteAccount,
  recordDividend,
  recordInterest,
  sellQuantity,
  unarchiveAccount,
  updatePrice,
  type FormState,
} from "./actions";

type Props = {
  accountId: string;
  market: "us" | "tw" | "crypto" | "manual";
  currentQty: number;
  currentBalance: number;
  currentPrice: number;
  currentFx: number;
  nativeCurrency: string;
  currentCost: number;
  status: "active" | "archived";
};

const fmtShares = (n: number) =>
  Number.isFinite(n) && n > 0
    ? n.toLocaleString("en-US", { maximumFractionDigits: 8 })
    : "—";

const fmtTwd = (n: number) =>
  n.toLocaleString("zh-TW", { maximumFractionDigits: 0 });

const pnlClass = (n: number) =>
  n > 0 ? "text-rose-700 dark:text-rose-400" : n < 0 ? "text-emerald-700 dark:text-emerald-400" : "text-[var(--c-muted)]";
const pnlSign = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "");

export function AccountActions({
  accountId,
  market,
  currentQty,
  currentBalance,
  currentPrice,
  currentFx,
  nativeCurrency,
  currentCost,
  status,
}: Props) {
  const isManual = market === "manual";
  const isArchived = status === "archived";

  const [updateState, updateAction, updatePending] = useActionState<FormState, FormData>(
    updatePrice,
    undefined,
  );
  const [addState, addAction, addPending] = useActionState<FormState, FormData>(
    addByAmount,
    undefined,
  );
  const [sellState, sellAction, sellPending] = useActionState<FormState, FormData>(
    sellQuantity,
    undefined,
  );
  const [divState, divAction, divPending] = useActionState<FormState, FormData>(
    recordDividend,
    undefined,
  );
  const [intState, intAction, intPending] = useActionState<FormState, FormData>(
    recordInterest,
    undefined,
  );
  const [qtyState, qtyAction, qtyPending] = useActionState<FormState, FormData>(
    adjustQuantity,
    undefined,
  );
  const [balState, balAction, balPending] = useActionState<FormState, FormData>(
    adjustBalance,
    undefined,
  );
  const [delState, delAction, delPending] = useActionState<FormState, FormData>(
    deleteAccount,
    undefined,
  );
  const [archState, archAction, archPending] = useActionState<FormState, FormData>(
    isArchived ? unarchiveAccount : archiveAccount,
    undefined,
  );
  const [confirmDelete, setConfirmDelete] = useState(false);

  // === 加碼預覽 ===
  const [twd, setTwd] = useState("");
  const [priceOverride, setPriceOverride] = useState("");
  const [fxOverride, setFxOverride] = useState("");
  const [occurredAt, setOccurredAt] = useState("");
  const [note, setNote] = useState("");
  const twdN = Number(twd);
  const priceN = priceOverride ? Number(priceOverride) : currentPrice;
  const fxN = fxOverride ? Number(fxOverride) : currentFx;
  const perShareTwd = priceN * fxN;
  const previewShares =
    Number.isFinite(twdN) && twdN > 0 && perShareTwd > 0 ? twdN / perShareTwd : 0;
  const previewNewTotal = currentQty + previewShares;

  // === 賣出預覽 ===
  const [sellQtyStr, setSellQtyStr] = useState("");
  const [proceedsStr, setProceedsStr] = useState("");
  const [sellPriceOv, setSellPriceOv] = useState("");
  const [sellFxOv, setSellFxOv] = useState("");
  const sellQtyN = Number(sellQtyStr);
  const sellPriceN = sellPriceOv ? Number(sellPriceOv) : currentPrice;
  const sellFxN = sellFxOv ? Number(sellFxOv) : currentFx;
  const defaultProceeds =
    sellQtyN > 0 ? sellQtyN * sellPriceN * sellFxN : 0;
  const proceedsPreview = proceedsStr ? Number(proceedsStr) : defaultProceeds;
  const allocatedCost =
    currentQty > 0 && sellQtyN > 0 ? currentCost * (sellQtyN / currentQty) : 0;
  const realizedPnlPreview =
    Number.isFinite(proceedsPreview) && sellQtyN > 0 && sellQtyN <= currentQty
      ? proceedsPreview - allocatedCost
      : 0;

  return (
    <div className="flex flex-col gap-3">
      {/* === 更新價格 === */}
      {!isManual && (
        <form action={updateAction} className="flex items-center gap-3">
          <input type="hidden" name="accountId" value={accountId} />
          <button
            type="submit"
            disabled={updatePending}
            className="rounded-sm bg-[var(--c-accent)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
          >
            {updatePending ? "抓最新價中…" : "更新價格"}
          </button>
          {updateState?.error && (
            <span className="text-xs text-red-700 dark:text-red-300">{updateState.error}</span>
          )}
        </form>
      )}

      {/* === 加碼買入 === */}
      {!isManual && (
        <details className="rounded-md border border-[var(--c-border)] bg-[var(--c-surface)]">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium">
            加碼買入（依 TWD 金額自動換算股數）
          </summary>
          <form action={addAction} className="flex flex-col gap-3 border-t border-[var(--c-border)] p-4">
            <input type="hidden" name="accountId" value={accountId} />

            <label className="flex flex-col gap-1 text-xs text-[var(--c-muted)]">
              投入金額（TWD）
              <input
                name="twd"
                type="number"
                step="any"
                min="0"
                required
                value={twd}
                onChange={(e) => setTwd(e.target.value)}
                placeholder="例：50000"
                className="mt-1 rounded border border-[var(--c-border)] px-2 py-1.5 text-sm text-[var(--c-text)]"
              />
            </label>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs text-[var(--c-muted)]">
                成交價（{nativeCurrency}，留空 = 市價 {currentPrice || "—"}）
                <input
                  name="priceOverride"
                  type="number"
                  step="any"
                  min="0"
                  value={priceOverride}
                  onChange={(e) => setPriceOverride(e.target.value)}
                  placeholder={currentPrice ? String(currentPrice) : ""}
                  className="mt-1 rounded border border-[var(--c-border)] px-2 py-1.5 text-sm text-[var(--c-text)]"
                />
              </label>

              <label className="flex flex-col gap-1 text-xs text-[var(--c-muted)]">
                匯率 ({nativeCurrency}/TWD，留空 = 目前 {currentFx})
                <input
                  name="fxOverride"
                  type="number"
                  step="any"
                  min="0"
                  value={fxOverride}
                  onChange={(e) => setFxOverride(e.target.value)}
                  placeholder={String(currentFx)}
                  disabled={currentFx === 1}
                  className="mt-1 rounded border border-[var(--c-border)] px-2 py-1.5 text-sm text-[var(--c-text)] disabled:bg-zinc-50 dark:disabled:bg-zinc-900 disabled:text-[var(--c-faint)]"
                />
              </label>
            </div>

            <label className="flex flex-col gap-1 text-xs text-[var(--c-muted)]">
              加入時間（留空 = 現在）
              <input
                name="occurredAt"
                type="datetime-local"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
                className="mt-1 rounded border border-[var(--c-border)] px-2 py-1.5 text-sm text-[var(--c-text)]"
              />
            </label>

            <label className="flex flex-col gap-1 text-xs text-[var(--c-muted)]">
              備註（選填）
              <input
                name="note"
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="例：5/30 永豐定額"
                className="mt-1 rounded border border-[var(--c-border)] px-2 py-1.5 text-sm text-[var(--c-text)]"
              />
            </label>

            <div className="rounded-sm border border-[var(--c-border)] bg-[var(--c-surface-soft)] px-3 py-2 text-xs text-[var(--c-muted)]">
              預估加入股數：
              <span className="ml-1 font-semibold tabular-nums text-[var(--c-text)]">
                {fmtShares(previewShares)}
              </span>
              <span className="mx-2 text-[var(--c-faint)]">·</span>
              加入後總持有：
              <span className="ml-1 font-semibold tabular-nums text-[var(--c-text)]">
                {fmtShares(previewNewTotal)}
              </span>
            </div>

            {addState?.error && (
              <p className="rounded bg-red-50 dark:bg-red-950/40 px-2 py-1 text-xs text-red-700 dark:text-red-300">
                {addState.error}
              </p>
            )}
            <button
              type="submit"
              disabled={addPending}
              className="self-start rounded-sm bg-[var(--c-btn-strong-bg)] px-4 py-1.5 text-sm font-medium text-[var(--c-btn-strong-text)] hover:opacity-90 disabled:opacity-50"
            >
              {addPending ? "送出中…" : "確認加碼"}
            </button>
          </form>
        </details>
      )}

      {/* === 賣出（含已實現損益計算）=== */}
      {!isManual && (
        <details className="rounded-md border border-[var(--c-border)] bg-[var(--c-surface)]">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium">
            賣出（記錄已實現損益）
          </summary>
          <form action={sellAction} className="flex flex-col gap-3 border-t border-[var(--c-border)] p-4">
            <input type="hidden" name="accountId" value={accountId} />

            <label className="flex flex-col gap-1 text-xs text-[var(--c-muted)]">
              賣出股數（目前持有 {fmtShares(currentQty)}）
              <input
                name="sellQty"
                type="number"
                step="any"
                min="0"
                max={currentQty}
                required
                value={sellQtyStr}
                onChange={(e) => setSellQtyStr(e.target.value)}
                placeholder="例：0.5"
                className="mt-1 rounded border border-[var(--c-border)] px-2 py-1.5 text-sm text-[var(--c-text)]"
              />
            </label>

            <label className="flex flex-col gap-1 text-xs text-[var(--c-muted)]">
              收入（TWD，留空 = 股數 × 市價 × FX）
              <input
                name="proceedsTwd"
                type="number"
                step="any"
                min="0"
                value={proceedsStr}
                onChange={(e) => setProceedsStr(e.target.value)}
                placeholder={defaultProceeds > 0 ? String(Math.round(defaultProceeds)) : ""}
                className="mt-1 rounded border border-[var(--c-border)] px-2 py-1.5 text-sm text-[var(--c-text)]"
              />
              <span className="mt-1 text-[10px] text-[var(--c-faint)]">
                券商實際匯入帳戶金額（扣完手續費）。留空就用市場估算。
              </span>
            </label>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs text-[var(--c-muted)]">
                成交價 ({nativeCurrency}, 留空 = 市價)
                <input
                  name="priceOverride"
                  type="number"
                  step="any"
                  min="0"
                  value={sellPriceOv}
                  onChange={(e) => setSellPriceOv(e.target.value)}
                  placeholder={currentPrice ? String(currentPrice) : ""}
                  className="mt-1 rounded border border-[var(--c-border)] px-2 py-1.5 text-sm text-[var(--c-text)]"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-[var(--c-muted)]">
                匯率 (留空 = 目前 {currentFx})
                <input
                  name="fxOverride"
                  type="number"
                  step="any"
                  min="0"
                  value={sellFxOv}
                  onChange={(e) => setSellFxOv(e.target.value)}
                  placeholder={String(currentFx)}
                  disabled={currentFx === 1}
                  className="mt-1 rounded border border-[var(--c-border)] px-2 py-1.5 text-sm text-[var(--c-text)] disabled:bg-zinc-50 dark:disabled:bg-zinc-900 disabled:text-[var(--c-faint)]"
                />
              </label>
            </div>

            <label className="flex flex-col gap-1 text-xs text-[var(--c-muted)]">
              成交時間（留空 = 現在）
              <input
                name="occurredAt"
                type="datetime-local"
                className="mt-1 rounded border border-[var(--c-border)] px-2 py-1.5 text-sm text-[var(--c-text)]"
              />
            </label>

            <label className="flex flex-col gap-1 text-xs text-[var(--c-muted)]">
              備註（選填）
              <input
                name="note"
                type="text"
                placeholder="例：6/15 部分獲利了結"
                className="mt-1 rounded border border-[var(--c-border)] px-2 py-1.5 text-sm text-[var(--c-text)]"
              />
            </label>

            <div className="rounded-sm border border-[var(--c-border)] bg-[var(--c-surface-soft)] px-3 py-2 text-xs text-[var(--c-muted)]">
              <div>
                預估收入：
                <span className="ml-1 font-semibold tabular-nums text-[var(--c-text)]">
                  NT$ {fmtTwd(proceedsPreview)}
                </span>
              </div>
              <div className="mt-1">
                被賣部位的成本：
                <span className="ml-1 tabular-nums text-[var(--c-text)]">
                  NT$ {fmtTwd(allocatedCost)}
                </span>
              </div>
              <div className="mt-1">
                預估已實現損益：
                <span
                  className={`ml-1 font-semibold tabular-nums ${pnlClass(realizedPnlPreview)}`}
                >
                  {pnlSign(realizedPnlPreview)}NT$ {fmtTwd(Math.abs(realizedPnlPreview))}
                </span>
              </div>
            </div>

            {sellState?.error && (
              <p className="rounded bg-red-50 dark:bg-red-950/40 px-2 py-1 text-xs text-red-700 dark:text-red-300">
                {sellState.error}
              </p>
            )}
            <button
              type="submit"
              disabled={sellPending}
              className="self-start rounded-sm bg-[var(--c-btn-strong-bg)] px-4 py-1.5 text-sm font-medium text-[var(--c-btn-strong-text)] hover:opacity-90 disabled:opacity-50"
            >
              {sellPending ? "送出中…" : "確認賣出"}
            </button>
          </form>
        </details>
      )}

      {/* === 配息（非手動）=== */}
      {!isManual && (
        <details className="rounded-md border border-[var(--c-border)] bg-[var(--c-surface)]">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium">
            記錄配息
          </summary>
          <form action={divAction} className="flex flex-col gap-3 border-t border-[var(--c-border)] p-4">
            <input type="hidden" name="accountId" value={accountId} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs text-[var(--c-muted)]">
                金額（TWD）
                <input
                  name="amount"
                  type="number"
                  step="any"
                  min="0"
                  required
                  placeholder="例：1200"
                  className="mt-1 rounded border border-[var(--c-border)] px-2 py-1.5 text-sm text-[var(--c-text)]"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-[var(--c-muted)]">
                配發日（留空 = 現在）
                <input
                  name="occurredAt"
                  type="datetime-local"
                  className="mt-1 rounded border border-[var(--c-border)] px-2 py-1.5 text-sm text-[var(--c-text)]"
                />
              </label>
            </div>
            <label className="flex flex-col gap-1 text-xs text-[var(--c-muted)]">
              備註（選填）
              <input
                name="note"
                type="text"
                placeholder="例：Q2 季配"
                className="mt-1 rounded border border-[var(--c-border)] px-2 py-1.5 text-sm text-[var(--c-text)]"
              />
            </label>
            {divState?.error && (
              <p className="rounded bg-red-50 dark:bg-red-950/40 px-2 py-1 text-xs text-red-700 dark:text-red-300">
                {divState.error}
              </p>
            )}
            <button
              type="submit"
              disabled={divPending}
              className="self-start rounded-sm bg-[var(--c-btn-strong-bg)] px-4 py-1.5 text-sm font-medium text-[var(--c-btn-strong-text)] hover:opacity-90 disabled:opacity-50"
            >
              {divPending ? "送出中…" : "記錄配息"}
            </button>
          </form>
        </details>
      )}

      {/* === 利息（所有帳戶都可記錄）=== */}
      <details className="rounded-md border border-[var(--c-border)] bg-[var(--c-surface)]">
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium">
          記錄利息
        </summary>
        <form action={intAction} className="flex flex-col gap-3 border-t border-[var(--c-border)] p-4">
          <input type="hidden" name="accountId" value={accountId} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs text-[var(--c-muted)]">
              金額（TWD）
              <input
                name="amount"
                type="number"
                step="any"
                min="0"
                required
                placeholder="例：50"
                className="mt-1 rounded border border-[var(--c-border)] px-2 py-1.5 text-sm text-[var(--c-text)]"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-[var(--c-muted)]">
              入帳日（留空 = 現在）
              <input
                name="occurredAt"
                type="datetime-local"
                className="mt-1 rounded border border-[var(--c-border)] px-2 py-1.5 text-sm text-[var(--c-text)]"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-xs text-[var(--c-muted)]">
            備註（選填）
            <input
              name="note"
              type="text"
              placeholder="例：玉山活儲 6 月利息"
              className="mt-1 rounded border border-[var(--c-border)] px-2 py-1.5 text-sm text-[var(--c-text)]"
            />
          </label>
          {intState?.error && (
            <p className="rounded bg-red-50 dark:bg-red-950/40 px-2 py-1 text-xs text-red-700 dark:text-red-300">
              {intState.error}
            </p>
          )}
          <button
            type="submit"
            disabled={intPending}
            className="self-start rounded-sm bg-[var(--c-btn-strong-bg)] px-4 py-1.5 text-sm font-medium text-[var(--c-btn-strong-text)] hover:opacity-90 disabled:opacity-50"
          >
            {intPending ? "送出中…" : "記錄利息"}
          </button>
        </form>
      </details>

      {/* === 增減股數（覆寫總量）=== */}
      {!isManual && (
        <details className="rounded-md border border-[var(--c-border)] bg-[var(--c-surface)]">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium">
            增減股數 / 數量（直接覆寫總持有）
          </summary>
          <form action={qtyAction} className="flex flex-col gap-3 border-t border-[var(--c-border)] p-4">
            <input type="hidden" name="accountId" value={accountId} />
            <label className="flex flex-col gap-1 text-xs text-[var(--c-muted)]">
              新的持有數量（會同時重新抓價並寫入快照）
              <input
                name="quantity"
                type="number"
                step="any"
                min="0"
                required
                defaultValue={currentQty}
                className="mt-1 rounded border border-[var(--c-border)] px-2 py-1.5 text-sm text-[var(--c-text)]"
              />
              <span className="mt-1 text-[10px] text-[var(--c-faint)]">
                注意：這只是「校正持有數」，不算真實買賣交易。要精準損益請走「賣出」。
              </span>
            </label>
            {qtyState?.error && (
              <p className="rounded bg-red-50 dark:bg-red-950/40 px-2 py-1 text-xs text-red-700 dark:text-red-300">
                {qtyState.error}
              </p>
            )}
            <button
              type="submit"
              disabled={qtyPending}
              className="self-start rounded-sm bg-[var(--c-btn-strong-bg)] px-4 py-1.5 text-sm font-medium text-[var(--c-btn-strong-text)] hover:opacity-90 disabled:opacity-50"
            >
              {qtyPending ? "套用中…" : "套用"}
            </button>
          </form>
        </details>
      )}

      {/* === 修改餘額（manual）=== */}
      {isManual && (
        <details className="rounded-md border border-[var(--c-border)] bg-[var(--c-surface)]">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium">
            修改餘額
          </summary>
          <form action={balAction} className="flex flex-col gap-3 border-t border-[var(--c-border)] p-4">
            <input type="hidden" name="accountId" value={accountId} />
            <label className="flex flex-col gap-1 text-xs text-[var(--c-muted)]">
              新餘額（TWD）
              <input
                name="balance"
                type="number"
                step="any"
                min="0"
                required
                defaultValue={currentBalance}
                className="mt-1 rounded border border-[var(--c-border)] px-2 py-1.5 text-sm text-[var(--c-text)]"
              />
            </label>
            {balState?.error && (
              <p className="rounded bg-red-50 dark:bg-red-950/40 px-2 py-1 text-xs text-red-700 dark:text-red-300">
                {balState.error}
              </p>
            )}
            <button
              type="submit"
              disabled={balPending}
              className="self-start rounded-sm bg-[var(--c-btn-strong-bg)] px-4 py-1.5 text-sm font-medium text-[var(--c-btn-strong-text)] hover:opacity-90 disabled:opacity-50"
            >
              {balPending ? "套用中…" : "套用"}
            </button>
          </form>
        </details>
      )}

      {/* === 歸檔 / 取消歸檔 === */}
      <form action={archAction} className="mt-2 flex items-center gap-3">
        <input type="hidden" name="accountId" value={accountId} />
        <button
          type="submit"
          disabled={archPending}
          className="text-xs text-[var(--c-muted)] underline hover:text-[var(--c-text)] disabled:opacity-50"
        >
          {archPending
            ? "處理中…"
            : isArchived
              ? "取消歸檔（恢復顯示）"
              : "歸檔此帳戶（不再抓價、不計入總值）"}
        </button>
        {archState?.error && (
          <span className="text-xs text-red-700 dark:text-red-300">{archState.error}</span>
        )}
      </form>

      {/* === 刪除 === */}
      <form action={delAction} className="flex items-center gap-3">
        <input type="hidden" name="accountId" value={accountId} />
        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="text-xs text-[var(--c-muted)] underline hover:text-[var(--c-text)]"
          >
            刪除帳戶
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-[var(--c-muted)]">確定刪除？此操作不可復原。</span>
            <button
              type="submit"
              disabled={delPending}
              className="rounded-sm bg-red-700 dark:bg-red-600 px-3 py-1 font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {delPending ? "刪除中…" : "確定刪除"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="rounded-sm border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-1 text-[var(--c-text)]"
            >
              取消
            </button>
          </div>
        )}
        {delState?.error && <span className="text-xs text-red-700 dark:text-red-300">{delState.error}</span>}
      </form>
    </div>
  );
}
