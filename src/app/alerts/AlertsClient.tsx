"use client";

import { useActionState, useState } from "react";
import {
  createAlert,
  deleteAlert,
  toggleAlert,
  type FormState,
} from "@/lib/alert-actions";

export type AlertAccount = {
  id: string;
  name: string;
  symbol: string | null;
  market: string;
  price: number | null;
  ccy: string;
};

export type AlertItem = {
  id: string;
  type: "price_above" | "price_below" | "allocation_drift";
  accountId: string | null;
  threshold: number;
  note: string | null;
  active: boolean;
  lastTriggered: string | null;
  accountName: string | null;
  accountSymbol: string | null;
};

type AlertType = AlertItem["type"];

const TYPES: Record<
  AlertType,
  { label: string; long: string; glyph: string; color: string; desc: string }
> = {
  price_above: {
    label: "突破上界",
    long: "價格突破上界",
    glyph: "↗",
    color: "var(--c-up)",
    desc: "價格漲到設定值時通知",
  },
  price_below: {
    label: "跌破下界",
    long: "價格跌破下界",
    glyph: "↘",
    color: "var(--c-down)",
    desc: "價格跌到設定值時通知",
  },
  allocation_drift: {
    label: "配置偏離",
    long: "配置偏離目標",
    glyph: "⊘",
    color: "#C58BD6",
    desc: "任一類別偏離目標過多時通知",
  },
};

const fmtPrice = (n: number, ccy: string) =>
  (ccy === "USD" ? "US$ " : "NT$ ") +
  Number(n).toLocaleString("en-US", {
    maximumFractionDigits: ccy === "USD" ? 2 : 0,
  });

/* ---------- 開關（持久化用 server action）---------- */
function Toggle({ id, active }: { id: string; active: boolean }) {
  return (
    <form action={toggleAlert}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="active" value={active ? "0" : "1"} />
      <button
        type="submit"
        role="switch"
        aria-checked={active}
        aria-label={active ? "停用" : "啟用"}
        className={`relative h-6 w-[42px] rounded-full border transition-colors ${
          active
            ? "border-[var(--c-up)] bg-[var(--c-up)]"
            : "border-[var(--c-line-strong)] bg-[var(--c-surface-soft)]"
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-[18px] w-[18px] rounded-full shadow transition-transform ${
            active ? "translate-x-[18px] bg-white" : "bg-[var(--c-text)]"
          }`}
        />
      </button>
    </form>
  );
}

/* ---------- 距觸發資訊 ---------- */
function triggerInfo(
  a: AlertItem,
  acc: AlertAccount | undefined,
  currentDrift: number | null,
): { closeness: number; label: string; reached: boolean } {
  if (a.type === "allocation_drift") {
    if (currentDrift == null)
      return { closeness: 0, label: "尚無配置資料", reached: false };
    const reached = currentDrift >= a.threshold;
    return {
      closeness: Math.min(1, currentDrift / a.threshold),
      label: reached ? "已超過門檻" : `目前最大偏離 ${currentDrift.toFixed(1)}%`,
      reached,
    };
  }
  const cur = acc?.price ?? null;
  if (cur == null || cur <= 0)
    return { closeness: 0, label: "等待報價", reached: false };
  if (a.type === "price_above") {
    const reached = cur >= a.threshold;
    const diff = ((a.threshold - cur) / cur) * 100;
    return {
      closeness: Math.min(1, cur / a.threshold),
      label: reached ? "已達標" : `還差 +${diff.toFixed(1)}%`,
      reached,
    };
  }
  const reached = cur <= a.threshold;
  const diff = ((cur - a.threshold) / cur) * 100;
  return {
    closeness: Math.min(1, a.threshold / cur),
    label: reached ? "已達標" : `還差 −${diff.toFixed(1)}%`,
    reached,
  };
}

/* ---------- 條件白話文 ---------- */
function ConditionText({
  type,
  acc,
  threshold,
}: {
  type: AlertType;
  acc: AlertAccount | undefined;
  threshold: string;
}) {
  const t =
    threshold === "" || threshold == null
      ? "—"
      : Number(threshold).toLocaleString("en-US");
  if (type === "allocation_drift")
    return (
      <>
        當任一類別偏離目標 <b className="font-semibold text-[var(--c-text)]">≥ {t}%</b> 時提醒我
      </>
    );
  const name = (
    <b className="font-semibold text-[var(--c-text)]">
      {acc ? acc.symbol || acc.name : "—"}
    </b>
  );
  const unit = acc ? (acc.ccy === "USD" ? "US$ " : "NT$ ") : "";
  return type === "price_above" ? (
    <>
      當 {name} 價格{" "}
      <b className="font-semibold text-[var(--c-up)]">
        ≥ {unit}
        {t}
      </b>{" "}
      時提醒我
    </>
  ) : (
    <>
      當 {name} 價格{" "}
      <b className="font-semibold text-[var(--c-down)]">
        ≤ {unit}
        {t}
      </b>{" "}
      時提醒我
    </>
  );
}

/* ---------- 新增面板 ---------- */
function CreatePanel({ accounts }: { accounts: AlertAccount[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    createAlert,
    undefined,
  );
  const [type, setType] = useState<AlertType>("price_above");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [threshold, setThreshold] = useState("");
  const [note, setNote] = useState("");
  const needAccount = type !== "allocation_drift";
  const acc = accounts.find((a) => a.id === accountId);

  // 成功後清空輸入（保留所選類型 / 帳戶）。
  // 用 React 官方「render 期間依結果調整 state」模式（有 guard，避免迴圈），
  // 不放 effect 內，符合 set-state-in-effect 規則。
  const [ackOk, setAckOk] = useState(false);
  if (state?.ok && !ackOk) {
    setAckOk(true);
    setThreshold("");
    setNote("");
  } else if (!state?.ok && ackOk) {
    setAckOk(false);
  }

  return (
    <form action={action} className="pt-1">
      <h2 className="text-[19px] font-medium tracking-tight">
        新增提醒
      </h2>

      {/* 三張類型卡 */}
      <input type="hidden" name="type" value={type} />
      <div className="mt-[18px] grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {(Object.keys(TYPES) as AlertType[]).map((k) => {
          const t = TYPES[k];
          const on = type === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setType(k)}
              aria-pressed={on}
              style={{ "--tc": t.color } as React.CSSProperties}
              className={`flex flex-col items-start gap-[3px] rounded-xl border p-[14px] text-left transition-all duration-150 ${
                on
                  ? "border-[color-mix(in_srgb,var(--tc)_60%,transparent)] bg-[color-mix(in_srgb,var(--tc)_11%,var(--c-surface))] shadow-[0_0_0_2px_color-mix(in_srgb,var(--tc)_20%,transparent),0_4px_14px_rgba(0,0,0,0.18)]"
                  : "border-[var(--c-border)] bg-[var(--c-surface-soft)] hover:-translate-y-[1px] hover:border-[var(--c-line-strong)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.14)]"
              }`}
            >
              <span
                className="mb-[5px] grid h-8 w-8 place-items-center rounded-[9px] text-lg"
                style={{
                  color: "var(--tc)",
                  background: "color-mix(in srgb, var(--tc) 14%, transparent)",
                }}
              >
                {t.glyph}
              </span>
              <span className="text-sm font-semibold">{t.label}</span>
              <span className="text-[11.5px] leading-[1.35] text-[var(--c-muted)]">
                {t.desc}
              </span>
            </button>
          );
        })}
      </div>

      {/* 表單 */}
      <div className="mt-[18px] grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        {needAccount && (
          <label className="flex flex-col gap-[7px]">
            <span className="text-xs font-medium text-[var(--c-muted)]">帳戶</span>
            <select
              name="accountId"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="h-[42px] rounded-[10px] border border-[var(--c-border)] bg-[var(--c-surface-soft)] px-3.5 text-sm text-[var(--c-text)] outline-none focus:border-[color-mix(in_srgb,var(--c-accent)_50%,transparent)] focus:shadow-[0_0_0_3px_var(--c-accent-soft)]"
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
        <label className="flex flex-col gap-[7px]">
          <span className="flex items-baseline gap-2 text-xs font-medium text-[var(--c-muted)]">
            {needAccount ? "目標價格" : "偏離門檻（%）"}
            {needAccount && acc?.price != null && (
              <span className="text-[11px] text-[var(--c-accent)] tnum">
                現價 {fmtPrice(acc.price, acc.ccy)}
              </span>
            )}
          </span>
          <input
            name="threshold"
            type="number"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            placeholder={needAccount ? "例：200" : "例：5"}
            min="0.01"
            step="any"
            required
            className="h-[42px] rounded-[10px] border border-[var(--c-border)] bg-[var(--c-surface-soft)] px-3.5 text-sm text-[var(--c-text)] outline-none placeholder:text-[var(--c-faint)] focus:border-[color-mix(in_srgb,var(--c-accent)_50%,transparent)] focus:shadow-[0_0_0_3px_var(--c-accent-soft)]"
          />
        </label>
        <label
          className={`flex flex-col gap-[7px] ${needAccount ? "sm:col-span-2" : ""}`}
        >
          <span className="text-xs font-medium text-[var(--c-muted)]">
            備註（選填）
          </span>
          <input
            name="note"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="例：等回檔加碼"
            className="h-[42px] rounded-[10px] border border-[var(--c-border)] bg-[var(--c-surface-soft)] px-3.5 text-sm text-[var(--c-text)] outline-none placeholder:text-[var(--c-faint)] focus:border-[color-mix(in_srgb,var(--c-accent)_50%,transparent)] focus:shadow-[0_0_0_3px_var(--c-accent-soft)]"
          />
        </label>
      </div>

      {/* 即時白話預覽 */}
      <div className="mt-4 flex items-center gap-2.5 rounded-[11px] border border-dashed border-[var(--c-line-strong)] bg-[var(--c-surface-soft)] px-4 py-3 text-sm text-[var(--c-muted)]">
        <span className="text-[11px]" style={{ color: TYPES[type].color }}>
          ◆
        </span>
        <ConditionText type={type} acc={acc} threshold={threshold} />
      </div>

      <div className="mt-[18px] flex flex-wrap items-center gap-3.5">
        <button
          type="submit"
          disabled={pending || !threshold}
          className="rounded-[10px] bg-[var(--c-accent)] px-[18px] py-2.5 text-sm font-semibold text-[var(--c-btn-strong-text)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {pending ? "建立中…" : "＋ 建立提醒"}
        </button>
        {state?.ok && (
          <span className="text-[13px] font-semibold text-[var(--c-up)]">
            ✓ 已新增
          </span>
        )}
        {state?.error && (
          <span className="text-[13px] text-[var(--c-down)]">{state.error}</span>
        )}
        <span className="ml-auto text-[11px] text-[var(--c-faint)]">
          每日抓價後檢查（台北 14:00）· 價格提醒觸發一次後自動停用
        </span>
      </div>
    </form>
  );
}

/* ---------- 警示卡 ---------- */
function AlertCard({
  a,
  accounts,
  currentDrift,
}: {
  a: AlertItem;
  accounts: AlertAccount[];
  currentDrift: number | null;
}) {
  const t = TYPES[a.type];
  const acc = a.accountId
    ? accounts.find((x) => x.id === a.accountId)
    : undefined;
  const info = triggerInfo(a, acc, currentDrift);
  const unit = acc ? (acc.ccy === "USD" ? "US$ " : "NT$ ") : "";
  const accLabel = acc
    ? acc.symbol || acc.name
    : a.accountSymbol || a.accountName || "—";

  return (
    // 去卡片化：警示改帳本列（靠底線分隔），不再盒裝（D8）
    <div
      className={`grid grid-cols-[auto_1fr] items-center gap-3 border-b border-[var(--c-border)] py-4 sm:grid-cols-[auto_1fr_auto] sm:gap-[15px] ${
        a.active ? "" : "opacity-[0.58]"
      }`}
    >
      <span
        className="grid h-10 w-10 place-items-center rounded-[11px] text-[19px]"
        style={
          {
            "--tc": t.color,
            color: "var(--tc)",
            background: "color-mix(in srgb, var(--tc) 14%, transparent)",
          } as React.CSSProperties
        }
      >
        {t.glyph}
      </span>

      <div className="min-w-0">
        <div className="flex flex-col items-start justify-between gap-[3px] sm:flex-row sm:items-baseline sm:gap-3">
          <span className="text-[15px] font-medium">
            {a.type === "allocation_drift" ? (
              <>
                任一類別偏離目標{" "}
                <b className="font-bold">≥ {a.threshold}%</b>
              </>
            ) : (
              <>
                {accLabel} {a.type === "price_above" ? "≥" : "≤"}{" "}
                <b className="font-bold">
                  {unit}
                  {Number(a.threshold).toLocaleString("en-US")}
                </b>
              </>
            )}
          </span>
          <span
            className="whitespace-nowrap text-[11.5px] font-semibold"
            style={{ color: t.color }}
          >
            {t.long}
          </span>
        </div>

        {/* 距觸發進度條 */}
        <div className="mt-2.5 flex items-center gap-[11px]">
          <div className="h-1.5 flex-1 overflow-hidden rounded-[3px] bg-[var(--c-surface-soft)]">
            <span
              className="block h-full rounded-[3px] transition-[width] duration-700 ease-out"
              style={{
                width: `${(info.closeness * 100).toFixed(1)}%`,
                background: info.reached ? t.color : "var(--c-line-strong)",
              }}
            />
          </div>
          <span
            className={`whitespace-nowrap text-xs tnum ${
              info.reached ? "font-semibold" : "text-[var(--c-muted)]"
            }`}
            style={info.reached ? { color: t.color } : {}}
          >
            {info.label}
          </span>
        </div>

        <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-xs text-[var(--c-faint)]">
          {acc?.price != null && (
            <span className="tnum">現價 {fmtPrice(acc.price, acc.ccy)}</span>
          )}
          {a.note && <span className="text-[var(--c-muted)]">· {a.note}</span>}
          {a.lastTriggered && (
            <span>
              · 上次觸發{" "}
              {new Date(a.lastTriggered).toLocaleDateString("en-CA")}
            </span>
          )}
        </div>
      </div>

      <div className="col-start-2 flex items-center justify-end gap-2 sm:col-start-3">
        {!a.active && (
          <span className="rounded-full border border-[var(--c-border)] px-2 py-px text-[11px] text-[var(--c-faint)]">
            已停用
          </span>
        )}
        <Toggle id={a.id} active={a.active} />
        <form action={deleteAlert}>
          <input type="hidden" name="id" value={a.id} />
          <button
            type="submit"
            title="刪除"
            aria-label="刪除提醒"
            className="grid h-[34px] w-[34px] place-items-center rounded-[9px] border border-transparent text-sm text-[var(--c-muted)] transition-colors hover:border-[color-mix(in_srgb,var(--c-down)_30%,transparent)] hover:bg-[color-mix(in_srgb,var(--c-down)_12%,transparent)] hover:text-[var(--c-down)]"
          >
            🗑
          </button>
        </form>
      </div>
    </div>
  );
}

/* ---------- 列表標題 ---------- */
function ListHead({
  on,
  label,
  count,
}: {
  on: boolean;
  label: string;
  count: number;
}) {
  return (
    <div
      className={`mb-0.5 mt-3.5 flex items-center gap-[9px] text-[13px] font-semibold ${
        on ? "text-[var(--c-text)]" : "mt-[22px] text-[var(--c-muted)]"
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${
          on
            ? "bg-[var(--c-up)] shadow-[0_0_0_3px_color-mix(in_srgb,var(--c-up)_22%,transparent)]"
            : "bg-[var(--c-faint)]"
        }`}
      />
      {label}
      <span className="rounded-full bg-[var(--c-surface-soft)] px-2 py-px text-[11.5px] text-[var(--c-faint)] tnum">
        {count}
      </span>
    </div>
  );
}

/* ---------- 組合 ---------- */
export function AlertsClient({
  accounts,
  alerts,
  currentDrift,
}: {
  accounts: AlertAccount[];
  alerts: AlertItem[];
  currentDrift: number | null;
}) {
  const active = alerts.filter((a) => a.active);
  const paused = alerts.filter((a) => !a.active);

  return (
    <div className="flex flex-col">
      <div className="overflow-hidden rounded-[var(--r-card)] border border-[var(--c-border)] bg-[var(--c-surface)] p-5 shadow-[var(--c-shadow)] sm:p-6">
        <CreatePanel accounts={accounts} />
      </div>

      <div className="mt-5 flex flex-col pt-1">
        <ListHead on label="啟用中" count={active.length} />
        {active.length === 0 ? (
          <div className="rounded-[14px] border border-dashed border-[var(--c-border)] px-5 py-[22px] text-center text-[13.5px] text-[var(--c-muted)]">
            目前沒有啟用中的提醒。
          </div>
        ) : (
          active.map((a) => (
            <AlertCard
              key={a.id}
              a={a}
              accounts={accounts}
              currentDrift={currentDrift}
            />
          ))
        )}

        {paused.length > 0 && (
          <>
            <ListHead on={false} label="已停用" count={paused.length} />
            {paused.map((a) => (
              <AlertCard
                key={a.id}
                a={a}
                accounts={accounts}
                currentDrift={currentDrift}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
