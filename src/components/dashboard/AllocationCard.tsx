"use client";

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

/* 狀態住在 DashboardClient，因為持倉帳本也要用同一個選取。
   hover 與 click 分成兩個是先前修掉的一個 bug：共用一個 state 時
   onMouseLeave 會把 click 的結果一併清掉，滑鼠使用者永遠釘不住。 */
export function AllocationCard({
  allocation,
  allocTargets,
  total,
  pinnedCls,
  activeCls,
  onHover,
  onPin,
}: {
  allocation: AllocDatum[];
  allocTargets: AllocTarget[];
  total: number;
  pinnedCls: string | null;
  activeCls: string | null;
  onHover: (cls: string | null) => void;
  onPin: (cls: string) => void;
}) {
  const selected = activeCls
    ? allocation.find((item) => item.cls === activeCls)
    : null;

  return (
    <div>
      <CardHead title="資產配置" sub="目前配置與目標比例" />
      {/* 圓環與清單只在 640–1179px 之間並排。≥1180px 時本卡被塞進 344px 的窄欄
          （見 DashboardClient 的並排斷點），並排會把清單擠到 160px——實測欄位
          需要 8+54+bar+56 加三個間距，長條只剩 12px——所以那個區間上下堆疊。
          寫成 sm:max-[1180px] 這種區間而不是 sm 疊 min-[1180px]：後者實測
          被 sm 蓋過（量到 grid-template-columns 仍是 176px 160px），
          兩條規則的先後順序不該賭。上界寫 1180 而不是 1179，是因為 Tailwind v4
          把 max-[N] 編成 `not (min-width: N)`，是嚴格小於；寫 1179 時
          視窗剛好 1179px 會兩條規則都不成立，掉進縫裡。 */}
      <div className="grid grid-cols-1 items-center gap-6 sm:max-[1180px]:grid-cols-[176px_1fr] sm:max-[1180px]:gap-7">
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
            onHover={onHover}
            hoverCls={activeCls}
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
                aria-pressed={pinnedCls === item.cls}
                aria-label={`${item.label}：實際 ${item.actual.toFixed(1)}%、目標 ${item.target.toFixed(0)}%`}
                className={`grid min-h-11 w-full grid-cols-[auto_54px_1fr_56px] items-center gap-2.5 rounded-[var(--r-control)] px-1.5 text-left ${
                  activeCls && activeCls !== item.cls ? "opacity-40" : ""
                }`}
                onMouseEnter={() => onHover(item.cls)}
                onMouseLeave={() => onHover(null)}
                onFocus={() => onHover(item.cls)}
                onBlur={() => onHover(null)}
                onClick={() => onPin(item.cls)}
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
                    pinnedCls === item.cls
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
