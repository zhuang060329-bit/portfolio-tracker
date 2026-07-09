"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { allocColor, fmtTwd } from "./DashboardCharts";
import type { Holding } from "./types";
import { sign, toneCls, TONE_TEXT } from "./shared";

/* ---------- 持有資產 ---------- */
type SortKey = "name" | "value" | "day" | "pnl";

export function Holdings({
  holdings,
  total,
  marketLabel,
  archivedCount,
  showArchived,
  demo,
}: {
  holdings: Holding[];
  total: number;
  marketLabel: Record<string, string>;
  archivedCount: number;
  showArchived: boolean;
  demo?: boolean;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("value");
  const [dir, setDir] = useState(-1);

  const rows = useMemo(() => {
    const r = [...holdings];
    r.sort((a, b) => {
      if (sortKey === "name") return dir * a.name.localeCompare(b.name);
      let av = 0;
      let bv = 0;
      if (sortKey === "value") {
        av = a.value;
        bv = b.value;
      } else if (sortKey === "pnl") {
        av = a.value - a.cost;
        bv = b.value - b.cost;
      } else {
        // day：null 視為最小
        av = a.day ?? -Infinity;
        bv = b.day ?? -Infinity;
      }
      return dir * (av - bv);
    });
    return r;
  }, [holdings, sortKey, dir]);

  const setSort = (k: SortKey) => {
    if (k === sortKey) setDir(-dir);
    else {
      setSortKey(k);
      setDir(-1);
    }
  };
  const sortedOf = (k: SortKey): "ascending" | "descending" | undefined =>
    sortKey === k ? (dir === -1 ? "descending" : "ascending") : undefined;

  const dayCell = (day: number | null) =>
    day == null || day === 0
      ? "—"
      : `${sign(day)}${Math.abs(day * 100).toFixed(2)}%`;

  return (
    <section className="px-5 pb-5 pt-5 sm:px-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span aria-hidden="true" className="mt-[3px] h-[15px] w-[3px] shrink-0 rounded-full bg-[var(--c-accent)]" />
          <div>
            <h2 className="text-[18px] font-semibold tracking-tight">持有資產</h2>
            {archivedCount > 0 && (
              <p className="mt-1 text-sm text-[var(--c-muted)]">
                <Link
                  href={showArchived ? "/" : "/?archived=1"}
                  className="underline hover:text-[var(--c-text)]"
                >
                  {showArchived
                    ? `隱藏 ${archivedCount} 個已歸檔`
                    : `顯示 ${archivedCount} 個已歸檔`}
                </Link>
              </p>
            )}
          </div>
        </div>
        {!demo && (
          <Link
            href="/accounts/new"
            className="shrink-0 rounded-[var(--r-control)] bg-[var(--c-accent)] px-4 py-2.5 text-[13.5px] font-semibold text-[var(--c-btn-strong-text)] transition hover:brightness-110"
          >
            ＋ 新增帳戶
          </Link>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--c-border)] bg-[var(--c-surface)] px-6 py-12 text-center text-sm text-[var(--c-muted)]">
          還沒有任何帳戶。點右上「＋ 新增帳戶」建立第一個。
        </div>
      ) : (
        <>
          {/* 桌機表格（去盒裝：扁平帳本表，靠列分隔線）*/}
          <div className="hidden md:block">
            <table className="w-full border-collapse text-[13.5px]">
              <thead>
                <tr className="bg-[var(--c-surface-soft)] text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--c-muted)]">
                  <Th onClick={() => setSort("name")} align="left" sorted={sortedOf("name")}>
                    帳戶
                  </Th>
                  <Th align="left">市場</Th>
                  <Th>佔比</Th>
                  <Th onClick={() => setSort("value")} sorted={sortedOf("value")}>市值</Th>
                  <Th onClick={() => setSort("day")} sorted={sortedOf("day")}>今日</Th>
                  <Th onClick={() => setSort("pnl")} sorted={sortedOf("pnl")}>未實現</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((h) => {
                  const pnl = h.value - h.cost;
                  const pct = h.cost > 0 ? (pnl / h.cost) * 100 : 0;
                  const share = total > 0 ? (h.value / total) * 100 : 0;
                  return (
                    <tr
                      key={h.id}
                      className={`border-t border-[var(--c-border)] transition-colors hover:bg-[var(--c-surface-soft)] ${
                        h.status === "archived" ? "opacity-60" : ""
                      }`}
                    >
                      <td className="max-w-[260px] px-[18px] py-3.5 text-left">
                        <span
                          className="mr-2.5 inline-block h-2 w-2 rounded-[3px] align-middle"
                          style={{ background: allocColor(h.cls) }}
                        />
                        {demo ? (
                          <span className="inline-block max-w-[180px] truncate align-middle font-medium">
                            {h.name}
                          </span>
                        ) : (
                          <Link
                            href={`/accounts/${h.id}`}
                            className="inline-block max-w-[180px] truncate align-middle font-medium hover:text-[var(--c-accent)]"
                          >
                            {h.name}
                          </Link>
                        )}
                        {h.symbol && (
                          <span className="ml-[7px] text-[11px] font-medium text-[var(--c-muted)]">
                            {h.symbol}
                          </span>
                        )}
                      </td>
                      <td className="px-[18px] py-3.5 text-left text-[var(--c-muted)]">
                        {marketLabel[h.market] ?? h.market}
                      </td>
                      <td className="px-[18px] py-3.5 text-right">
                        <span className="inline-flex items-center justify-end gap-2.5">
                          <span className="h-1.5 w-14 overflow-hidden rounded-[3px] bg-[var(--c-surface-soft)]">
                            <span
                              className="block h-full rounded-[3px]"
                              style={{
                                width: `${share}%`,
                                background: allocColor(h.cls),
                              }}
                            />
                          </span>
                          <span className="w-9 text-right text-[11.5px] text-[var(--c-muted)] tnum">
                            {share.toFixed(1)}%
                          </span>
                        </span>
                      </td>
                      <td className="amt px-[18px] py-3.5 text-right font-semibold tnum">
                        {fmtTwd(h.value)}
                      </td>
                      <td
                        className={`px-[18px] py-3.5 text-right tnum ${
                          h.day == null ? "text-[var(--c-muted)]" : TONE_TEXT[toneCls(h.day)]
                        }`}
                      >
                        {dayCell(h.day)}
                      </td>
                      <td
                        className={`px-[18px] py-3.5 text-right tnum ${TONE_TEXT[toneCls(pnl)]}`}
                      >
                        {h.cost > 0 ? (
                          <>
                            <div className="amt font-semibold">
                              {sign(pnl)}
                              {fmtTwd(Math.abs(pnl))}
                            </div>
                            <div className="text-[11px] opacity-85">
                              {sign(pnl)}
                              {Math.abs(pct).toFixed(1)}%
                            </div>
                          </>
                        ) : (
                          <span className="text-[var(--c-muted)]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 手機：帳本列（去盒裝，靠底線分隔）*/}
          <div className="border-t border-[var(--c-border)] md:hidden">
            {rows.map((h) => {
              const pnl = h.value - h.cost;
              const pct = h.cost > 0 ? (pnl / h.cost) * 100 : 0;
              const share = total > 0 ? (h.value / total) * 100 : 0;
              const rowCls = `block border-b border-[var(--c-border)] py-3.5 ${
                h.status === "archived" ? "opacity-60" : ""
              }`;
              const inner = (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                        style={{ background: allocColor(h.cls) }}
                      />
                      <div className="min-w-0">
                        <div className="truncate font-medium">
                          {h.name}
                          {h.symbol && (
                            <span className="ml-[7px] text-[11px] text-[var(--c-muted)]">
                              {h.symbol}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[var(--c-muted)]">
                          {marketLabel[h.market] ?? h.market} · {share.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="amt font-semibold tnum">{fmtTwd(h.value)}</div>
                      {h.cost > 0 && (
                        <div className={`text-[11px] tnum ${TONE_TEXT[toneCls(pnl)]}`}>
                          {sign(pnl)}
                          {Math.abs(pct).toFixed(1)}%
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 h-[5px] overflow-hidden rounded-[3px] bg-[var(--c-surface-soft)]">
                    <span
                      className="block h-full rounded-[3px]"
                      style={{ width: `${share}%`, background: allocColor(h.cls) }}
                    />
                  </div>
                </>
              );
              // demo：列不可點（詳情頁需登入），也不給 hover/active 回饋暗示可點
              return demo ? (
                <div key={h.id} className={rowCls}>
                  {inner}
                </div>
              ) : (
                <Link
                  key={h.id}
                  href={`/accounts/${h.id}`}
                  className={`${rowCls} transition-colors hover:bg-[var(--c-surface-soft)] active:bg-[var(--c-accent-soft)]`}
                >
                  {inner}
                </Link>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

function Th({
  children,
  align = "right",
  onClick,
  sorted,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  onClick?: () => void;
  /** 此欄目前的排序方向；undefined = 可排但未選中，僅供 aria-sort 與箭頭 */
  sorted?: "ascending" | "descending";
}) {
  const alignCls = align === "left" ? "text-left" : "text-right";
  if (!onClick) {
    return (
      <th scope="col" className={`whitespace-nowrap px-[18px] py-3.5 ${alignCls}`}>
        {children}
      </th>
    );
  }
  // 可排序欄：真按鈕（鍵盤可達）+ th 帶 aria-sort，箭頭對 AT 隱藏
  return (
    <th
      scope="col"
      aria-sort={sorted ?? "none"}
      className={`whitespace-nowrap ${alignCls}`}
    >
      <button
        type="button"
        onClick={onClick}
        className={`w-full px-[18px] py-3.5 font-semibold uppercase tracking-[0.04em] ${alignCls} select-none hover:text-[var(--c-text)]`}
      >
        {children}
        <span aria-hidden="true">
          {sorted ? (sorted === "descending" ? " ↓" : " ↑") : ""}
        </span>
      </button>
    </th>
  );
}
