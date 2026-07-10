"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { allocColor, fmtTwd } from "./DashboardCharts";
import type { Holding } from "./types";
import { sign, toneCls, TONE_TEXT } from "./shared";

type SortKey = "name" | "value" | "day" | "pnl";

const SORT_LABEL: Record<SortKey, string> = {
  name: "名稱",
  value: "市值",
  day: "今日",
  pnl: "損益",
};

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
  const [direction, setDirection] = useState(-1);

  const rows = useMemo(() => {
    const sorted = [...holdings];
    sorted.sort((left, right) => {
      if (left.status !== right.status) {
        return left.status === "archived" ? 1 : -1;
      }
      if (sortKey === "name") {
        return direction * left.name.localeCompare(right.name);
      }
      const valueOf = (holding: Holding) => {
        if (sortKey === "value") return holding.value;
        if (sortKey === "pnl") return holding.value - holding.cost;
        return holding.day ?? -Infinity;
      };
      return direction * (valueOf(left) - valueOf(right));
    });
    return sorted;
  }, [holdings, sortKey, direction]);

  const activeCount = holdings.filter((holding) => holding.status !== "archived").length;

  function setSort(key: SortKey) {
    if (key === sortKey) setDirection((current) => -current);
    else {
      setSortKey(key);
      setDirection(-1);
    }
  }

  function sortedOf(key: SortKey): "ascending" | "descending" | undefined {
    return sortKey === key
      ? direction === -1
        ? "descending"
        : "ascending"
      : undefined;
  }

  function dayCell(day: number | null) {
    return day == null || day === 0
      ? "—"
      : `${sign(day)}${Math.abs(day * 100).toFixed(2)}%`;
  }

  return (
    <section className="pb-2 pt-5 sm:pb-4 sm:pt-6">
      <div className="flex items-start justify-between gap-4 px-4 sm:px-6">
        <div>
          <h2 className="text-[17px] font-semibold tracking-[-0.015em] sm:text-[18px]">
            持倉帳本
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[var(--c-muted)]">
            <span>{activeCount} 個有效帳戶</span>
            {archivedCount > 0 && (
              <>
                <span className="text-[var(--c-faint)]">·</span>
                <Link
                  href={showArchived ? "/" : "/?archived=1"}
                  className="underline decoration-[var(--c-line-strong)] underline-offset-4 hover:text-[var(--c-text)]"
                >
                  {showArchived
                    ? `隱藏 ${archivedCount} 個封存帳戶`
                    : `查看 ${archivedCount} 個封存帳戶`}
                </Link>
              </>
            )}
          </div>
        </div>

        {!demo && (
          <Link
            href="/accounts/new"
            className="inline-flex min-h-10 shrink-0 items-center rounded-[var(--r-control)] bg-[var(--c-accent)] px-3.5 text-[12px] font-semibold text-[var(--c-btn-strong-text)] hover:brightness-110 sm:px-4 sm:text-[13px]"
          >
            新增帳戶
          </Link>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="mx-4 mt-5 rounded-[var(--r-control)] border border-dashed border-[var(--c-border)] px-6 py-10 text-center text-sm text-[var(--c-muted)] sm:mx-6">
          尚未建立帳戶。
        </div>
      ) : (
        <>
          <div className="hide-scrollbar mt-4 flex gap-1.5 overflow-x-auto px-4 pb-1 md:hidden">
            {(Object.keys(SORT_LABEL) as SortKey[]).map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={sortKey === key}
                onClick={() => setSort(key)}
                className={`min-h-9 shrink-0 rounded-[var(--r-control)] border px-3 text-[12px] font-medium ${
                  sortKey === key
                    ? "border-[var(--c-line-strong)] bg-[var(--c-surface-soft)] text-[var(--c-text)]"
                    : "border-[var(--c-border)] text-[var(--c-muted)]"
                }`}
              >
                {SORT_LABEL[key]}
                {sortKey === key ? (direction === -1 ? " ↓" : " ↑") : ""}
              </button>
            ))}
          </div>

          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="w-full min-w-[760px] border-collapse text-[13px]">
              <thead>
                <tr className="border-y border-[var(--c-border)] bg-[var(--c-surface-soft)] text-[10px] font-semibold tracking-[0.06em] text-[var(--c-muted)]">
                  <TableHead
                    onClick={() => setSort("name")}
                    align="left"
                    sorted={sortedOf("name")}
                  >
                    帳戶
                  </TableHead>
                  <TableHead align="left">市場</TableHead>
                  <TableHead>配置</TableHead>
                  <TableHead
                    onClick={() => setSort("value")}
                    sorted={sortedOf("value")}
                  >
                    市值
                  </TableHead>
                  <TableHead
                    onClick={() => setSort("day")}
                    sorted={sortedOf("day")}
                  >
                    今日
                  </TableHead>
                  <TableHead
                    onClick={() => setSort("pnl")}
                    sorted={sortedOf("pnl")}
                  >
                    未實現
                  </TableHead>
                </tr>
              </thead>
              <tbody>
                {rows.map((holding) => {
                  const pnl = holding.value - holding.cost;
                  const pnlPct = holding.cost > 0 ? (pnl / holding.cost) * 100 : 0;
                  const share =
                    holding.status === "archived" || total <= 0
                      ? null
                      : (holding.value / total) * 100;
                  return (
                    <tr
                      key={holding.id}
                      className={`border-b border-[var(--c-border)] hover:bg-[var(--c-surface-soft)] ${
                        holding.status === "archived" ? "opacity-60" : ""
                      }`}
                    >
                      <td className="max-w-[280px] px-6 py-4 text-left">
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className="h-2 w-2 shrink-0 rounded-[2px]"
                            style={{ background: allocColor(holding.cls) }}
                          />
                          <div className="min-w-0">
                            {demo ? (
                              <span className="block truncate font-medium">
                                {holding.name}
                              </span>
                            ) : (
                              <Link
                                href={`/accounts/${holding.id}`}
                                className="block truncate font-medium hover:text-[var(--c-accent)]"
                              >
                                {holding.name}
                              </Link>
                            )}
                            <div className="mt-0.5 flex items-center gap-2 text-[10px] text-[var(--c-faint)]">
                              {holding.symbol && <span>{holding.symbol}</span>}
                              {holding.status === "archived" && (
                                <span className="rounded border border-[var(--c-border)] px-1.5 py-0.5">
                                  已封存
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-left text-[var(--c-muted)]">
                        {marketLabel[holding.market] ?? holding.market}
                      </td>
                      <td className="px-5 py-4 text-right">
                        {share == null ? (
                          <span className="text-[var(--c-faint)]">—</span>
                        ) : (
                          <span className="inline-flex items-center justify-end gap-2.5">
                            <span className="h-1 w-12 overflow-hidden bg-[var(--c-border)]">
                              <span
                                className="block h-full"
                                style={{
                                  width: `${Math.min(100, share)}%`,
                                  background: allocColor(holding.cls),
                                }}
                              />
                            </span>
                            <span className="w-9 text-right text-[11px] text-[var(--c-muted)] tnum">
                              {share.toFixed(1)}%
                            </span>
                          </span>
                        )}
                      </td>
                      <td className="amt px-5 py-4 text-right font-semibold tnum">
                        {fmtTwd(holding.value)}
                      </td>
                      <td
                        className={`px-5 py-4 text-right tnum ${
                          holding.day == null
                            ? "text-[var(--c-muted)]"
                            : TONE_TEXT[toneCls(holding.day)]
                        }`}
                      >
                        {dayCell(holding.day)}
                      </td>
                      <td
                        className={`px-6 py-4 text-right tnum ${TONE_TEXT[toneCls(pnl)]}`}
                      >
                        {holding.cost > 0 ? (
                          <>
                            <div className="amt font-semibold">
                              {sign(pnl)}
                              {fmtTwd(Math.abs(pnl))}
                            </div>
                            <div className="mt-0.5 text-[10px] opacity-80">
                              {sign(pnl)}
                              {Math.abs(pnlPct).toFixed(1)}%
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

          <div className="mt-2 border-t border-[var(--c-border)] md:hidden">
            {rows.map((holding) => {
              const pnl = holding.value - holding.cost;
              const pnlPct = holding.cost > 0 ? (pnl / holding.cost) * 100 : 0;
              const share =
                holding.status === "archived" || total <= 0
                  ? null
                  : (holding.value / total) * 100;
              const rowClass = `block border-b border-[var(--c-border)] px-4 py-4 ${
                holding.status === "archived" ? "opacity-60" : ""
              }`;
              const content = (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-2.5">
                      <span
                        className="mt-1.5 h-2 w-2 shrink-0 rounded-[2px]"
                        style={{ background: allocColor(holding.cls) }}
                      />
                      <div className="min-w-0">
                        <div className="truncate text-[14px] font-medium">
                          {holding.name}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-[var(--c-muted)]">
                          <span>{marketLabel[holding.market] ?? holding.market}</span>
                          {holding.symbol && (
                            <>
                              <span className="text-[var(--c-faint)]">·</span>
                              <span>{holding.symbol}</span>
                            </>
                          )}
                          {holding.status === "archived" && (
                            <span className="rounded border border-[var(--c-border)] px-1.5 py-0.5">
                              已封存
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="amt text-[15px] font-semibold tnum">
                        NT$ {fmtTwd(holding.value)}
                      </div>
                      <div className="mt-1 text-[10px] text-[var(--c-muted)]">
                        {share == null ? "不計入配置" : `配置 ${share.toFixed(1)}%`}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 border-t border-[var(--c-border-soft)] pt-3 text-[11px]">
                    <div>
                      <span className="text-[var(--c-faint)]">今日</span>
                      <span
                        className={`ml-2 font-medium tnum ${
                          holding.day == null
                            ? "text-[var(--c-muted)]"
                            : TONE_TEXT[toneCls(holding.day)]
                        }`}
                      >
                        {dayCell(holding.day)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[var(--c-faint)]">未實現</span>
                      <span
                        className={`ml-2 font-medium tnum ${TONE_TEXT[toneCls(pnl)]}`}
                      >
                        {holding.cost > 0
                          ? `${sign(pnl)}${Math.abs(pnlPct).toFixed(1)}%`
                          : "—"}
                      </span>
                    </div>
                  </div>

                  {share != null && (
                    <div className="mt-3 h-[3px] overflow-hidden bg-[var(--c-border)]">
                      <span
                        className="block h-full"
                        style={{
                          width: `${Math.min(100, share)}%`,
                          background: allocColor(holding.cls),
                        }}
                      />
                    </div>
                  )}
                </>
              );

              return demo ? (
                <div key={holding.id} className={rowClass}>
                  {content}
                </div>
              ) : (
                <Link
                  key={holding.id}
                  href={`/accounts/${holding.id}`}
                  className={`${rowClass} hover:bg-[var(--c-surface-soft)] active:bg-[var(--c-accent-soft)]`}
                >
                  {content}
                </Link>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

function TableHead({
  children,
  align = "right",
  onClick,
  sorted,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  onClick?: () => void;
  sorted?: "ascending" | "descending";
}) {
  const alignClass = align === "left" ? "text-left" : "text-right";
  if (!onClick) {
    return (
      <th scope="col" className={`whitespace-nowrap px-5 py-3 ${alignClass}`}>
        {children}
      </th>
    );
  }

  return (
    <th scope="col" aria-sort={sorted ?? "none"} className={alignClass}>
      <button
        type="button"
        onClick={onClick}
        className={`w-full px-5 py-3 font-semibold tracking-[0.06em] ${alignClass} hover:text-[var(--c-text)]`}
      >
        {children}
        <span aria-hidden="true">
          {sorted ? (sorted === "descending" ? " ↓" : " ↑") : ""}
        </span>
      </button>
    </th>
  );
}
