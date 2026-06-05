"use client";

import { useActionState, useState } from "react";
import {
  createAlert,
  deleteAlert,
  toggleAlert,
  type FormState,
} from "@/lib/alert-actions";

type Account = {
  id: string;
  name: string;
  symbol: string | null;
  price_market: string;
  last_unit_price: number | null;
};

type Alert = {
  id: string;
  type: "price_above" | "price_below" | "allocation_drift";
  account_id: string | null;
  threshold: number;
  note: string | null;
  active: boolean;
  last_triggered_at: string | null;
  created_at: string;
  account?: { id: string; name: string; symbol: string | null } | null;
};

const TYPE_LABEL: Record<Alert["type"], string> = {
  price_above: "價格突破上界",
  price_below: "價格跌破下界",
  allocation_drift: "配置偏離",
};

export function AlertsManager({
  accounts,
  alerts,
}: {
  accounts: Account[];
  alerts: Alert[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    createAlert,
    undefined,
  );
  const [type, setType] = useState<Alert["type"]>("price_above");
  const [accountId, setAccountId] = useState<string>(accounts[0]?.id ?? "");
  const needAccount = type !== "allocation_drift";
  const currentAccount = accounts.find((a) => a.id === accountId);

  return (
    <div className="flex flex-col gap-6">
      {/* 新增表單 */}
      <form
        action={action}
        className="rounded-md border border-[var(--c-border)] bg-[var(--c-surface)] p-5 shadow-sm"
      >
        <h2 className="font-serif text-lg font-semibold tracking-tight">
          新增警示
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-[var(--c-muted)]">
            類型
            <select
              name="type"
              value={type}
              onChange={(e) => setType(e.target.value as Alert["type"])}
              className="mt-1 rounded border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-2 text-sm text-[var(--c-text)]"
            >
              <option value="price_above">價格突破上界</option>
              <option value="price_below">價格跌破下界</option>
              <option value="allocation_drift">配置偏離超過 X%</option>
            </select>
          </label>

          {needAccount && (
            <label className="flex flex-col gap-1 text-xs text-[var(--c-muted)]">
              帳戶
              <select
                name="accountId"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="mt-1 rounded border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-2 text-sm text-[var(--c-text)]"
                required
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                    {a.symbol ? ` · ${a.symbol}` : ""}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="flex flex-col gap-1 text-xs text-[var(--c-muted)]">
            {needAccount
              ? `閾值${
                  currentAccount?.last_unit_price
                    ? `（現價 ${currentAccount.last_unit_price}）`
                    : ""
                }`
              : "偏離門檻（百分比）"}
            <input
              name="threshold"
              type="number"
              step="any"
              min="0.01"
              required
              placeholder={needAccount ? "例：100" : "例：5"}
              className="mt-1 rounded border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-2 text-sm text-[var(--c-text)]"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-[var(--c-muted)] sm:col-span-2">
            備註（選填）
            <input
              name="note"
              type="text"
              placeholder="例：等 QQQM 跌到 200 加碼"
              className="mt-1 rounded border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-2 text-sm text-[var(--c-text)]"
            />
          </label>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-sm bg-[var(--c-accent)] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "新增中…" : "新增警示"}
          </button>
          {state?.error && (
            <span className="text-xs text-rose-700 dark:text-rose-400">
              {state.error}
            </span>
          )}
          {state?.ok && (
            <span className="text-xs text-emerald-700 dark:text-emerald-400">
              已新增
            </span>
          )}
        </div>

        <p className="mt-4 border-t border-[var(--c-border)] pt-3 text-[10px] text-[var(--c-faint)]">
          警示在每日 cron 抓完價後檢查（台北時間下午 2 點）。價格警示觸發一次後會自動停用；
          配置偏離警示 24 小時內最多觸發一次。
        </p>
      </form>

      {/* 現有警示列表 */}
      <div className="rounded-md border border-[var(--c-border)] bg-[var(--c-surface)] shadow-sm">
        <h2 className="border-b border-[var(--c-border)] px-5 py-3 font-serif text-lg font-semibold tracking-tight">
          現有警示
        </h2>
        {alerts.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-[var(--c-muted)]">
            還沒有任何警示。
          </p>
        ) : (
          <ul className="divide-y divide-[var(--c-border-soft)]">
            {alerts.map((alert) => (
              <li
                key={alert.id}
                className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex rounded-sm px-2 py-0.5 text-[10px] ${
                        alert.active
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300"
                          : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                      }`}
                    >
                      {alert.active ? "啟用中" : "已停用"}
                    </span>
                    <span className="font-medium">
                      {TYPE_LABEL[alert.type]}
                    </span>
                    {alert.account && (
                      <span className="text-[var(--c-muted)]">
                        · {alert.account.name}
                        {alert.account.symbol ? ` (${alert.account.symbol})` : ""}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-[var(--c-muted)]">
                    閾值：
                    <span className="tabular-nums text-[var(--c-text)]">
                      {alert.threshold}
                    </span>
                    {alert.type === "allocation_drift" && " %"}
                    {alert.note && (
                      <span className="ml-2 text-[var(--c-faint)]">
                        · {alert.note}
                      </span>
                    )}
                    {alert.last_triggered_at && (
                      <span className="ml-2 text-[var(--c-faint)]">
                        · 上次觸發 {new Date(alert.last_triggered_at).toLocaleDateString("en-CA")}
                      </span>
                    )}
                  </div>
                </div>
                <form action={toggleAlert} className="contents">
                  <input type="hidden" name="id" value={alert.id} />
                  <input
                    type="hidden"
                    name="active"
                    value={alert.active ? "0" : "1"}
                  />
                  <button
                    type="submit"
                    className="rounded-sm border border-[var(--c-border)] bg-[var(--c-surface)] px-2.5 py-1 text-xs text-[var(--c-text)] hover:bg-[var(--c-surface-soft)]"
                  >
                    {alert.active ? "停用" : "啟用"}
                  </button>
                </form>
                <form action={deleteAlert} className="contents">
                  <input type="hidden" name="id" value={alert.id} />
                  <button
                    type="submit"
                    className="rounded-sm border border-rose-300 bg-rose-50 px-2.5 py-1 text-xs text-rose-700 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
                  >
                    刪除
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
