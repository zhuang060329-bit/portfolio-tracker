"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ImportCsv } from "./ImportCsv";

export type ActRow = {
  id: string;
  type: string;
  accountId: string | null;
  accountName: string | null;
  symbol: string | null;
  market: string | null;
  qty: number | null;
  price: number | null;
  fx: number | null;
  value: number;
  amount: number | null; // cashflow_twd（有號）
  note: string | null;
  date: string; // Taipei YYYY-MM-DD
  time: string; // HH:mm Taipei
};

// 類型樣式：對應真實 DB 的 7 種 type（無 buy；加碼記為 adjust_quantity）。
const ACT_TYPES: Record<
  string,
  { label: string; color: string; glyph: string }
> = {
  create: { label: "新建帳戶", color: "var(--c-accent)", glyph: "✦" },
  adjust_quantity: { label: "調整數量", color: "#E0B15F", glyph: "±" },
  adjust_balance: { label: "修改餘額", color: "#7FA8C9", glyph: "≈" },
  price_update: { label: "更新價格", color: "var(--c-muted)", glyph: "↻" },
  sell: { label: "賣出", color: "var(--c-down)", glyph: "↘" },
  dividend: { label: "配息", color: "var(--c-up)", glyph: "＄" },
  interest: { label: "利息", color: "#C58BD6", glyph: "％" },
};
const TYPE_ORDER = [
  "sell",
  "dividend",
  "interest",
  "adjust_quantity",
  "adjust_balance",
  "price_update",
  "create",
];
const typeMeta = (t: string) =>
  ACT_TYPES[t] ?? { label: t, color: "var(--c-muted)", glyph: "•" };

const fmtTwd = (n: number) => Math.round(n).toLocaleString("en-US");
const fmtNum = (n: number | null, max = 8) =>
  n == null || !Number.isFinite(Number(n))
    ? "—"
    : Number(n).toLocaleString("en-US", { maximumFractionDigits: max });
const fmtAmt = (n: number) =>
  (n > 0 ? "+" : n < 0 ? "−" : "") +
  "NT$ " +
  Math.abs(Math.round(n)).toLocaleString("en-US");

function dateLabel(
  iso: string,
  today: string,
  yesterday: string,
): { big: string; sub: string } {
  // 用 Asia/Taipei 取星期，避免受瀏覽器時區影響。
  const wd = new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    weekday: "short",
  }).format(new Date(iso + "T12:00:00+08:00"));
  const [, m, d] = iso.split("-");
  const base = `${Number(m)} 月 ${Number(d)} 日 · ${wd}`;
  if (iso === today) return { big: "今天", sub: base };
  if (iso === yesterday) return { big: "昨天", sub: base };
  return { big: base, sub: "" };
}

function TypeBadge({ type }: { type: string }) {
  const t = typeMeta(type);
  return (
    <span
      className="inline-flex items-center gap-[5px] whitespace-nowrap rounded-md border py-[3px] pl-[7px] pr-[9px] text-xs font-semibold"
      style={
        {
          color: t.color,
          background: `color-mix(in srgb, ${t.color} 13%, transparent)`,
          borderColor: `color-mix(in srgb, ${t.color} 28%, transparent)`,
        } as React.CSSProperties
      }
    >
      <span className="text-[11px]">{t.glyph}</span>
      {t.label}
    </span>
  );
}

function LedgerRow({
  r,
  i,
  isLast,
}: {
  r: ActRow;
  i: number;
  isLast: boolean;
}) {
  const t = typeMeta(r.type);
  const showAmt = r.amount != null && r.amount !== 0;
  return (
    <div
      className="ledger-row-in grid grid-cols-[40px_1fr] sm:grid-cols-[56px_1fr]"
      style={{ animationDelay: `${Math.min(i * 28, 360)}ms` }}
    >
      <div className="relative flex justify-center">
        <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[var(--c-border)]" />
        <span
          className="relative z-[1] mt-3.5 grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold text-white shadow-[0_0_0_4px_var(--c-page)] dark:text-[#14130E] sm:h-7 sm:w-7 sm:text-[13px]"
          style={{ background: t.color }}
        >
          {t.glyph}
        </span>
      </div>
      <div
        className={`ml-1 py-3 ${isLast ? "" : "mb-2 border-b border-[var(--c-border)]"}`}
      >
        <div className="flex flex-col items-start justify-between gap-1.5 sm:flex-row sm:items-center sm:gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-x-[11px] gap-y-1">
            <TypeBadge type={r.type} />
            {r.accountId ? (
              <Link
                href={`/accounts/${r.accountId}`}
                className="text-[14.5px] font-semibold hover:text-[var(--c-accent)]"
              >
                {r.accountName}
                {r.symbol && (
                  <span className="ml-[7px] text-[11.5px] font-medium text-[var(--c-muted)]">
                    {r.symbol}
                  </span>
                )}
              </Link>
            ) : (
              <span className="text-[14.5px] font-semibold text-[var(--c-faint)]">
                已刪除帳戶
              </span>
            )}
          </div>
          <div className="flex w-full items-baseline justify-between gap-3.5 sm:w-auto sm:justify-end">
            {showAmt && (
              <span
                className={`text-[14.5px] font-semibold tnum ${
                  r.amount! > 0 ? "text-[var(--c-up)]" : "text-[var(--c-down)]"
                }`}
              >
                {fmtAmt(r.amount!)}
              </span>
            )}
            <span className="text-xs text-[var(--c-faint)] tnum">{r.time}</span>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap gap-x-[18px] gap-y-1.5">
          {r.market !== "manual" && r.price != null && (
            <Kv label="單價" value={fmtNum(r.price, 4)} />
          )}
          {r.qty != null && r.qty > 0 && r.market !== "manual" && (
            <Kv label="持有後" value={fmtNum(r.qty, 6)} />
          )}
          {r.fx != null && r.fx !== 1 && (
            <Kv label="匯率" value={fmtNum(r.fx, 2)} />
          )}
          <Kv label="市值" value={`NT$ ${fmtTwd(r.value)}`} strong />
        </div>

        {r.note && (
          <div className="mt-2 inline-block rounded-lg border border-[var(--c-border)] bg-[var(--c-surface)] px-[11px] py-[7px] text-[12.5px] text-[var(--c-muted)]">
            {r.note}
          </div>
        )}
      </div>
    </div>
  );
}

function Kv({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap text-[12.5px]">
      <i className="not-italic text-[var(--c-faint)]">{label}</i>
      <b
        className={`tnum ${
          strong
            ? "font-semibold text-[var(--c-text)]"
            : "font-medium text-[var(--c-muted)]"
        }`}
      >
        {value}
      </b>
    </span>
  );
}

export function ActivityClient({
  rows,
  today,
  yesterday,
}: {
  rows: ActRow[];
  today: string;
  yesterday: string;
}) {
  const [active, setActive] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of rows) c[r.type] = (c[r.type] ?? 0) + 1;
    return c;
  }, [rows]);

  const toggle = (type: string) =>
    setActive((prev) => {
      const n = new Set(prev);
      if (n.has(type)) n.delete(type);
      else n.add(type);
      return n;
    });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (active.size && !active.has(r.type)) return false;
      if (term) {
        const hay = `${r.accountName ?? ""} ${r.symbol ?? ""} ${
          typeMeta(r.type).label
        } ${r.note ?? ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [rows, active, q]);

  // 依日期分組（rows 已依時間倒序，連續同日歸一組）
  const groups = useMemo(() => {
    const out: { date: string; items: ActRow[] }[] = [];
    let cur: { date: string; items: ActRow[] } | null = null;
    for (const r of filtered) {
      if (!cur || cur.date !== r.date) {
        cur = { date: r.date, items: [] };
        out.push(cur);
      }
      cur.items.push(r);
    }
    return out;
  }, [filtered]);

  return (
    <>
      {/* 類型 chips（兼統計，可篩選）*/}
      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActive(new Set())}
          className={`inline-flex items-center gap-[7px] whitespace-nowrap rounded-full border px-3 py-[7px] text-[13px] font-medium transition-colors ${
            active.size === 0
              ? "border-[color-mix(in_srgb,var(--c-accent)_55%,transparent)] bg-[color-mix(in_srgb,var(--c-accent)_12%,var(--c-surface))] text-[var(--c-text)]"
              : "border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-muted)] hover:border-[var(--c-line-strong)] hover:text-[var(--c-text)]"
          }`}
        >
          全部
          <span className="rounded-full bg-[var(--c-surface-soft)] px-[7px] py-px text-[11.5px] text-[var(--c-faint)] tnum">
            {rows.length}
          </span>
        </button>
        {TYPE_ORDER.filter((t) => counts[t]).map((t) => {
          const meta = typeMeta(t);
          const on = active.has(t);
          return (
            <button
              key={t}
              type="button"
              onClick={() => toggle(t)}
              style={{ "--tc": meta.color } as React.CSSProperties}
              className={`inline-flex items-center gap-[7px] whitespace-nowrap rounded-full border px-3 py-[7px] text-[13px] font-medium transition-colors ${
                on
                  ? "border-[color-mix(in_srgb,var(--tc)_55%,transparent)] bg-[color-mix(in_srgb,var(--tc)_12%,var(--c-surface))] text-[var(--c-text)]"
                  : "border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-muted)] hover:border-[var(--c-line-strong)] hover:text-[var(--c-text)]"
              }`}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: "var(--tc)" }}
              />
              {meta.label}
              <span
                className={`rounded-full px-[7px] py-px text-[11.5px] tnum ${
                  on
                    ? "bg-[color-mix(in_srgb,var(--tc)_22%,transparent)] text-[var(--c-text)]"
                    : "bg-[var(--c-surface-soft)] text-[var(--c-faint)]"
                }`}
              >
                {counts[t]}
              </span>
            </button>
          );
        })}
      </div>

      {/* 工具列：搜尋 + 匯入 */}
      <div className="mt-4 flex flex-col items-stretch gap-3 sm:flex-row sm:items-start">
        <div className="relative min-w-0 flex-1">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-base text-[var(--c-faint)]">
            ⌕
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜尋帳戶、類型或備註…"
            className="h-11 w-full rounded-[11px] border border-[var(--c-border)] bg-[var(--c-surface)] pl-10 pr-9 text-sm text-[var(--c-text)] outline-none placeholder:text-[var(--c-faint)] focus:border-[color-mix(in_srgb,var(--c-accent)_50%,transparent)] focus:shadow-[0_0_0_3px_var(--c-accent-soft)]"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              aria-label="清除搜尋"
              className="absolute right-2.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-base text-[var(--c-muted)] hover:bg-[var(--c-surface-soft)] hover:text-[var(--c-text)]"
            >
              ×
            </button>
          )}
        </div>
        <div className="shrink-0 sm:w-80">
          <ImportCsv />
        </div>
      </div>

      {/* 時間軸帳本 */}
      {groups.length === 0 ? (
        <div className="mt-10 text-center text-sm text-[var(--c-muted)]">
          {rows.length === 0
            ? "還沒有任何變動。建立帳戶或執行操作後，這裡會出現記錄。"
            : "沒有符合條件的紀錄。"}
          {rows.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setActive(new Set());
                setQ("");
              }}
              className="ml-2 text-[var(--c-accent)] underline"
            >
              清除篩選
            </button>
          )}
        </div>
      ) : (
        <div className="mt-7">
          {groups.map((g) => {
            const lab = dateLabel(g.date, today, yesterday);
            const dayNet = g.items.reduce((s, r) => s + (r.amount ?? 0), 0);
            return (
              <section key={g.date} className="mb-2">
                <div className="flex items-baseline justify-between gap-3 py-3 pl-0 sm:pl-14">
                  <div className="flex items-baseline gap-2.5 whitespace-nowrap">
                    <span className="font-serif text-[17px] font-medium">
                      {lab.big}
                    </span>
                    {lab.sub && (
                      <span className="text-xs text-[var(--c-muted)]">
                        {lab.sub}
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-3.5 whitespace-nowrap">
                    <span className="text-xs text-[var(--c-faint)]">
                      {g.items.length} 筆
                    </span>
                    {dayNet !== 0 && (
                      <span
                        className={`text-xs font-semibold tnum ${
                          dayNet > 0 ? "text-[var(--c-up)]" : "text-[var(--c-down)]"
                        }`}
                      >
                        淨現金流 {fmtAmt(dayNet)}
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  {g.items.map((r, i) => (
                    <LedgerRow
                      key={r.id}
                      r={r}
                      i={i}
                      isLast={i === g.items.length - 1}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
