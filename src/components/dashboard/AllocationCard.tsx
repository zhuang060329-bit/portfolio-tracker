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
  /* 原本 hover 與 click 共用一個 state，而 onMouseLeave 無條件清成 null，
     於是滑鼠使用者永遠釘不住任何一類：實測 mouseenter 讓 aria-pressed 變 true、
     接著 click 反而翻回 false（因為 hover 已經選上了，click 走的是取消那一支），
     mouseleave 再清一次。aria-pressed 宣告了一個持久狀態，實際上不存在。
     拆成兩個：hover 是暫時的預覽，click 是釘住的選擇，hover 優先顯示。 */
  const [pinned, setPinned] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const activeClass = hovered ?? pinned;
  const selected = activeClass
    ? allocation.find((item) => item.cls === activeClass)
    : null;

  return (
    <div>
      <CardHead title="資產配置" sub="目前配置與目標比例" />
      <div className="grid grid-cols-1 items-center gap-6 sm:grid-cols-[176px_1fr] sm:gap-7">
        {/* 中心字級從 --fs-2xl 降到 --fs-xl。Donut 的孔徑是算得出來的：
            size 176 → rad 74、inner 48，孔徑 96px。而 26px 下最寬的字串
            （「120.0萬」「9,999萬」這類四位數萬）量到 99–104px，本來就壓在
            圓環內緣上，資產一到千萬級必定疊字。22px 下同一批字串上限 88px，
            孔徑還剩 8px，而且 fmtCompact 的輸出長度有上界（萬最多四位、
            億最多三位有效數字），不可能再長。 */}
        <div className="relative mx-auto h-[176px] w-[176px]">
          <Donut
            data={allocation}
            size={176}
            onHover={setHovered}
            hoverCls={activeClass}
          />
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            {selected ? (
              <>
                <div className="text-[length:var(--fs-micro)] text-[var(--c-muted)]">
                  {selected.label}
                </div>
                <div className="mt-1 text-[length:var(--fs-xl)] font-semibold tracking-[-0.03em] tnum">
                  {selected.pct.toFixed(1)}%
                </div>
                <div className="amt mt-1 text-[length:var(--fs-micro)] text-[var(--c-faint)] tnum">
                  NT$ {fmtCompact(selected.value)}
                </div>
              </>
            ) : (
              <>
                <div className="text-[length:var(--fs-micro)] text-[var(--c-muted)]">總資產</div>
                <div className="amt mt-1 text-[length:var(--fs-xl)] font-semibold tracking-[-0.03em] tnum">
                  {fmtCompact(total)}
                </div>
                <div className="mt-1 text-[length:var(--fs-micro)] text-[var(--c-faint)]">
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
                /* 只反映釘住的狀態。hover 是預覽，報成 pressed 會讓讀屏使用者
                   聽到一個他沒有做過的選擇。 */
                aria-pressed={pinned === item.cls}
                aria-label={`${item.label}：實際 ${item.actual.toFixed(1)}%、目標 ${item.target.toFixed(0)}%`}
                className={`grid min-h-11 w-full grid-cols-[auto_54px_1fr_56px] items-center gap-2.5 rounded-[var(--r-control)] px-1.5 text-left ${
                  activeClass && activeClass !== item.cls ? "opacity-40" : ""
                }`}
                onMouseEnter={() => setHovered(item.cls)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(item.cls)}
                onBlur={() => setHovered(null)}
                onClick={() =>
                  setPinned((current) =>
                    current === item.cls ? null : item.cls,
                  )
                }
              >
                <span
                  className="h-2 w-2 rounded-[2px]"
                  style={{ background: allocColor(item.cls) }}
                />
                {/* 釘住的那一類用 PICK 語彙的文字訊號標出來，讓「滑過」與
                    「按住不放」兩種狀態分得開——只靠其他列變淡的話，兩者一樣。
                    這裡不取語彙裡的填色：本區塊落在 page 底色上，實測
                    surface-soft 對 page 在淺色主題只有 1.027:1，等於沒有。 */}
                <span
                  className={`truncate text-[length:var(--fs-sm)] ${
                    pinned === item.cls
                      ? "font-semibold text-[var(--c-accent)]"
                      : ""
                  }`}
                >
                  {item.label}
                </span>
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
                  <span className="text-[length:var(--fs-sm)] font-medium tnum">
                    {item.actual.toFixed(1)}%
                  </span>
                  {drift && (
                    <span
                      className="mt-0.5 text-[length:var(--fs-micro)] font-medium tnum"
                      style={{ color: drift.tone }}
                    >
                      {drift.text}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
          <p className="mt-1 text-[length:var(--fs-micro)] text-[var(--c-faint)]">
            細線標示目標配置
          </p>
        </div>
      </div>
    </div>
  );
}
