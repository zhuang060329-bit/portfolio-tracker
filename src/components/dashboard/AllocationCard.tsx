"use client";

import { useState } from "react";
import { allocColor, Donut, fmtCompact, type AllocDatum } from "./DashboardCharts";
import type { AllocTarget } from "./types";
import { CardHead, sign } from "./shared";

/* ---------- 配置偏離（percentage points）----------
 * drift = actual − target，單位 pp。這是「離目標多遠」的輔助判斷，
 * 不帶賺賠語義（超配不一定好、低配不一定壞），所以分級只用中性 token：
 *   |drift| < 1   → faint（基本對齊）
 *   1 ≤ |drift| < 5 → muted（輕微提醒）
 *   |drift| ≥ 5   → accent（較明顯提醒，金色只是「看這裡」非好壞）
 * target <= 0 / 不存在 / 非有限值 → 回傳 null（不顯示）。
 * 四捨五入到 1 位小數；接近 0 用 sign("")避免出現 "−0.0pp"。 */
function driftInfo(actual: number, target: number) {
  if (!(target > 0)) return null;
  const raw = actual - target;
  if (!Number.isFinite(raw)) return null;
  const d = Math.round(raw * 10) / 10; // 1 位小數
  const mag = Math.abs(d);
  const tone =
    mag < 1
      ? "var(--c-faint)"
      : mag < 5
        ? "var(--c-muted)"
        : "var(--c-accent)";
  return { text: `${sign(d)}${mag.toFixed(1)}pp`, tone };
}

/* ---------- 配置卡（donut + 目標長條）---------- */
export function AllocationCard({
  allocation,
  allocTargets,
  total,
}: {
  allocation: AllocDatum[];
  allocTargets: AllocTarget[];
  total: number;
}) {
  const [hoverCls, setHoverCls] = useState<string | null>(null);
  const sel = hoverCls ? allocation.find((a) => a.cls === hoverCls) : null;

  return (
    <div>
      <CardHead title="資產配置" sub="實際 vs 目標" />
      <div className="grid grid-cols-1 items-center gap-5 sm:grid-cols-[auto_1fr] sm:gap-7">
        <div className="relative mx-auto h-[188px] w-[188px]">
          <Donut
            data={allocation}
            size={188}
            onHover={setHoverCls}
            hoverCls={hoverCls}
          />
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            {sel ? (
              <>
                <div className="text-[11px] text-[var(--c-muted)]">
                  {sel.label}
                </div>
                <div className="mt-0.5 font-serif text-[26px] font-medium tnum">
                  {sel.pct.toFixed(1)}%
                </div>
                <div className="mt-0.5 text-[11.5px] text-[var(--c-faint)] tnum amt">
                  NT$ {fmtCompact(sel.value)}
                </div>
              </>
            ) : (
              <>
                <div className="text-[11px] text-[var(--c-muted)]">總資產</div>
                <div className="mt-0.5 font-serif text-[26px] font-medium tnum amt">
                  {fmtCompact(total)}
                </div>
                <div className="mt-0.5 text-[11.5px] text-[var(--c-faint)]">
                  {allocation.length} 類
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex w-full flex-col gap-[11px]">
          {allocTargets.map((a) => (
            <div
              key={a.cls}
              // 鍵盤 focus 與觸控點按等同 hover：donut 中心跟著顯示該類別數字
              tabIndex={0}
              role="button"
              aria-label={`${a.label}：實際 ${a.actual.toFixed(1)}%、目標 ${a.target.toFixed(0)}%`}
              className={`grid grid-cols-[auto_56px_1fr_58px] items-center gap-2.5 rounded-[6px] outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-[var(--c-accent)] ${
                hoverCls && hoverCls !== a.cls ? "opacity-40" : ""
              }`}
              onMouseEnter={() => setHoverCls(a.cls)}
              onMouseLeave={() => setHoverCls(null)}
              onFocus={() => setHoverCls(a.cls)}
              onBlur={() => setHoverCls(null)}
              onClick={() => setHoverCls(hoverCls === a.cls ? null : a.cls)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setHoverCls(hoverCls === a.cls ? null : a.cls);
                }
              }}
            >
              <span
                className="h-[9px] w-[9px] rounded-[3px]"
                style={{ background: allocColor(a.cls) }}
              />
              <span className="truncate text-[13px]">{a.label}</span>
              <span className="relative h-[7px] rounded bg-[var(--c-surface-soft)]">
                <span
                  className="absolute inset-y-0 left-0 rounded transition-[width] duration-700 ease-out"
                  style={{
                    width: `${Math.min(100, a.actual)}%`,
                    background: allocColor(a.cls),
                  }}
                />
                {a.target > 0 && (
                  // 目標 marker：加高、滿對比、加 1px page 色描邊，落在實際長條上時才分得出來
                  <span
                    className="absolute -top-[3px] -bottom-[3px] w-[2px] rounded-full bg-[var(--c-text)] shadow-[0_0_0_1px_var(--c-page)]"
                    style={{ left: `calc(${Math.min(100, a.target)}% - 1px)` }}
                    title={`目標 ${a.target}%`}
                  />
                )}
              </span>
              <span className="flex flex-col items-end leading-tight">
                <span className="text-[12.5px] font-medium tnum">
                  {a.actual.toFixed(1)}%
                </span>
                {(() => {
                  const d = driftInfo(a.actual, a.target);
                  return d ? (
                    <span
                      className="mt-0.5 text-[10px] font-medium tnum"
                      style={{ color: d.tone }}
                      title="相對目標配置的偏離（percentage points）"
                    >
                      {d.text}
                    </span>
                  ) : null;
                })()}
              </span>
            </div>
          ))}
          <p className="text-[11px] text-[var(--c-faint)]">
            <span className="text-[var(--c-text)]">▏</span> = 目標配置
          </p>
        </div>
      </div>
    </div>
  );
}
