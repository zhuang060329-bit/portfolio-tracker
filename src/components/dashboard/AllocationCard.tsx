"use client";

import { useState } from "react";
import {
  allocColor,
  Donut,
  fmtCompact,
  type AllocDatum,
} from "./DashboardCharts";
import type { AllocTarget } from "./types";
import { CardHead, sign } from "./shared";

function driftInfo(actual: number, target: number) {
  if (!(target > 0)) return null;
  const raw = actual - target;
  if (!Number.isFinite(raw)) return null;
  const drift = Math.round(raw * 10) / 10;
  const magnitude = Math.abs(drift);
  const tone =
    magnitude < 1
      ? "var(--c-faint)"
      : magnitude < 5
        ? "var(--c-muted)"
        : "var(--c-accent)";
  return { text: `${sign(drift)}${magnitude.toFixed(1)}pp`, tone };
}

export function AllocationCard({
  allocation,
  allocTargets,
  total,
}: {
  allocation: AllocDatum[];
  allocTargets: AllocTarget[];
  total: number;
}) {
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const selected = selectedClass
    ? allocation.find((item) => item.cls === selectedClass)
    : null;

  return (
    <div>
      <CardHead title="資產配置" sub="目前配置與目標比例" />
      <div className="grid grid-cols-1 items-center gap-6 sm:grid-cols-[176px_1fr] sm:gap-7">
        <div className="relative mx-auto h-[176px] w-[176px]">
          <Donut
            data={allocation}
            size={176}
            onHover={setSelectedClass}
            hoverCls={selectedClass}
          />
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            {selected ? (
              <>
                <div className="text-[11px] text-[var(--c-muted)]">
                  {selected.label}
                </div>
                <div className="mt-1 text-[24px] font-semibold tracking-[-0.03em] tnum">
                  {selected.pct.toFixed(1)}%
                </div>
                <div className="amt mt-1 text-[11px] text-[var(--c-faint)] tnum">
                  NT$ {fmtCompact(selected.value)}
                </div>
              </>
            ) : (
              <>
                <div className="text-[11px] text-[var(--c-muted)]">總資產</div>
                <div className="amt mt-1 text-[24px] font-semibold tracking-[-0.03em] tnum">
                  {fmtCompact(total)}
                </div>
                <div className="mt-1 text-[11px] text-[var(--c-faint)]">
                  {allocation.length} 類
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex w-full flex-col gap-1.5">
          {allocTargets.map((item) => {
            const drift = driftInfo(item.actual, item.target);
            return (
              <button
                key={item.cls}
                type="button"
                aria-pressed={selectedClass === item.cls}
                aria-label={`${item.label}：實際 ${item.actual.toFixed(1)}%、目標 ${item.target.toFixed(0)}%`}
                className={`grid min-h-11 w-full grid-cols-[auto_54px_1fr_56px] items-center gap-2.5 rounded-[var(--r-control)] px-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-accent)] ${
                  selectedClass && selectedClass !== item.cls ? "opacity-40" : ""
                }`}
                onMouseEnter={() => setSelectedClass(item.cls)}
                onMouseLeave={() => setSelectedClass(null)}
                onFocus={() => setSelectedClass(item.cls)}
                onBlur={() => setSelectedClass(null)}
                onClick={() =>
                  setSelectedClass((current) =>
                    current === item.cls ? null : item.cls,
                  )
                }
              >
                <span
                  className="h-2 w-2 rounded-[2px]"
                  style={{ background: allocColor(item.cls) }}
                />
                <span className="truncate text-[12px]">{item.label}</span>
                <span className="relative h-[5px] bg-[var(--c-border)]">
                  <span
                    className="absolute inset-y-0 left-0 transition-[width] duration-700 ease-out"
                    style={{
                      width: `${Math.min(100, item.actual)}%`,
                      background: allocColor(item.cls),
                    }}
                  />
                  {item.target > 0 && (
                    <span
                      className="absolute -bottom-[3px] -top-[3px] w-px bg-[var(--c-text)] shadow-[0_0_0_1px_var(--c-page)]"
                      style={{
                        left: `calc(${Math.min(100, item.target)}% - 1px)`,
                      }}
                      title={`目標 ${item.target}%`}
                    />
                  )}
                </span>
                <span className="flex flex-col items-end leading-tight">
                  <span className="text-[12px] font-medium tnum">
                    {item.actual.toFixed(1)}%
                  </span>
                  {drift && (
                    <span
                      className="mt-0.5 text-[9px] font-medium tnum"
                      style={{ color: drift.tone }}
                    >
                      {drift.text}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
          <p className="mt-1 text-[10px] text-[var(--c-faint)]">
            細線標示目標配置
          </p>
        </div>
      </div>
    </div>
  );
}
