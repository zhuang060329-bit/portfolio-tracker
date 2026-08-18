"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { allocColor, fmtTwd } from "./DashboardCharts";
import type { Holding } from "./types";
import { PICK_OFF, PICK_ON, sign, toneCls, TONE_TEXT } from "./shared";
import { useFlipRows } from "./useFlipRows";

type SortKey = "name" | "value" | "day" | "pnl";

/* 與桌機表頭逐字相同。原本手機寫「名稱」「損益」、桌機寫「帳戶」「未實現」，
   同一個排序鍵兩個名字，換裝置就得重新對應一次。 */
const SORT_LABEL: Record<SortKey, string> = {
  name: "帳戶",
  value: "市值",
  day: "今日",
  pnl: "未實現",
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
  // 桌面表格與手機卡片是兩份同時存在的 DOM，共用一個 hook 但 key 要分開，
  // 不然同一個 holding.id 會互相覆蓋。前綴 d- / m- 就夠。
  const flip = useFlipRows<string>();

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
    // 只有這裡 arm FLIP。背景刷新報價讓市值變、順序跟著重排時不會動畫。
    flip.capture();
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
          <h2 className="text-[length:var(--fs-lg)] font-semibold tracking-[-0.015em]">
            持倉帳本
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[length:var(--fs-sm)] text-[var(--c-muted)]">
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
            className="inline-flex min-h-10 shrink-0 items-center rounded-[var(--r-control)] bg-[var(--c-accent)] px-3.5 text-[length:var(--fs-sm)] font-semibold text-[var(--c-btn-strong-text)] hover:brightness-110 sm:px-4"
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
          {/* 一排沒有名字的藥丸看不出是排序還是篩選，補一個可見標籤，
              並用 role=group 讓讀屏在進入時先講出「排序」這件事。 */}
          <div
            role="group"
            aria-label="排序方式"
            className="hide-scrollbar mt-4 flex items-center gap-1.5 overflow-x-auto px-4 pb-1 md:hidden"
          >
            <span className="shrink-0 text-[length:var(--fs-micro)] text-[var(--c-faint)]">
              排序
            </span>
            {(Object.keys(SORT_LABEL) as SortKey[]).map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={sortKey === key}
                onClick={() => setSort(key)}
                className={`min-h-9 shrink-0 rounded-[var(--r-control)] border px-3 text-[length:var(--fs-sm)] ${
                  sortKey === key
                    ? `border-[var(--c-line-strong)] ${PICK_ON}`
                    : `border-[var(--c-border)] ${PICK_OFF}`
                }`}
              >
                {SORT_LABEL[key]}
                {sortKey === key ? (direction === -1 ? " ↓" : " ↑") : ""}
              </button>
            ))}
          </div>

          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="w-full min-w-[760px] border-collapse text-[length:var(--fs-sm)]">
              {/* 改版前欄寬全交給瀏覽器自動分配，結果與資訊量相反：實測「配置」
                  拿到 243px（全表最寬）卻只裝得下 93px 的內容，「市場」用 167px
                  放兩三個字，而會被 truncate 的「帳戶」只有 218px。
                  這裡用百分比明寫，把空間還給需要的欄。 */}
              <colgroup>
                <col className="w-[24%]" />
                {/* 市場 13%：表格最窄是 760px（min-w），13% = 99px，扣掉 px-5 的
                    40px 剛好放得下最長的「加密貨幣」（13px × 4 = 52px）。
                    先前給 11% 時實測那格斷成「加密貨 / 幣」——中日文可以在任何
                    字之間斷行，min-content 只有一個字，瀏覽器不會替你擋。 */}
                <col className="w-[13%]" />
                <col className="w-[19%]" />
                <col className="w-[15%]" />
                <col className="w-[12%]" />
                <col className="w-[17%]" />
              </colgroup>
              <thead>
                <tr className="border-y border-[var(--c-border)] bg-[var(--c-surface-soft)] text-[length:var(--fs-micro)] font-semibold tracking-[0.06em] text-[var(--c-muted)]">
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
                    市值 <Unit />
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
                    未實現 <Unit />
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
                      ref={flip.register(`d-${holding.id}`)}
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
                            <div className="mt-0.5 flex items-center gap-2 text-[length:var(--fs-micro)] text-[var(--c-faint)]">
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
                      <td className="whitespace-nowrap px-5 py-4 text-left text-[var(--c-muted)]">
                        {marketLabel[holding.market] ?? holding.market}
                      </td>
                      {/* 條改成撐滿欄寬。原本軌道固定 48px，而最大部位只有 39.4%，
                          實測填色 2.8–18.9px，5.8% 那格是個 2.8px 的點，看不出長短。
                          軌道跟著欄寬伸縮後同一組資料是 8–57px，才比得出來。
                          刻度維持 0–100% 絕對值，不改成「相對最大列」：滿格代表
                          單一帳戶吃掉整個組合，那條空白本身就是集中度的資訊。
                          軌道底色對卡片只有 1.25:1，留白不會變成噪音。 */}
                      <td className="px-5 py-4">
                        {share == null ? (
                          <span className="block text-right text-[var(--c-faint)]">—</span>
                        ) : (
                          <span className="flex items-center gap-3">
                            <span className="h-1 min-w-0 flex-1 overflow-hidden bg-[var(--c-border)]">
                              <span
                                className="block h-full"
                                style={{
                                  width: `${Math.min(100, share)}%`,
                                  background: allocColor(holding.cls),
                                }}
                              />
                            </span>
                            <span className="w-11 shrink-0 text-right text-[length:var(--fs-micro)] text-[var(--c-muted)] tnum">
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
                            <div className="mt-0.5 text-[length:var(--fs-micro)] opacity-80">
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
                        <div className="truncate text-[length:var(--fs-sm)] font-medium">
                          {holding.name}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[length:var(--fs-micro)] text-[var(--c-muted)]">
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
                      <div className="amt text-[length:var(--fs-md)] font-semibold tnum">
                        NT$ {fmtTwd(holding.value)}
                      </div>
                      <div className="mt-1 text-[length:var(--fs-micro)] text-[var(--c-muted)]">
                        {share == null ? "不計入配置" : `配置 ${share.toFixed(1)}%`}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 border-t border-[var(--c-border-soft)] pt-3 text-[length:var(--fs-micro)]">
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
                <div
                  key={holding.id}
                  ref={flip.register(`m-${holding.id}`)}
                  className={rowClass}
                >
                  {content}
                </div>
              ) : (
                <Link
                  key={holding.id}
                  ref={flip.register(`m-${holding.id}`)}
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

/* 表格有共同表頭，單位在這裡標一次，儲存格不重複（同 DashboardClient 四格的規則）。
   改版前整張表沒有任何幣別標示，而「美股 ETF」那列的市值是換算後的台幣，
   不標的話讀成美元是合理的誤讀。 */
function Unit() {
  return (
    <span className="font-normal tracking-normal text-[var(--c-faint)]">NT$</span>
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
      {/* 正在排序的欄原本只有一個箭頭，欄名本身跟其他欄一模一樣。
          改用與手機藥丸、區間鈕同一套 PICK 語彙，三個地方講同一句話。
          表頭列自身底色是 surface-soft，選中填色會與底色同色而看不出來，
          所以這裡只取語彙裡的文字訊號（accent + 字重）。 */}
      <button
        type="button"
        onClick={onClick}
        className={`w-full px-5 py-3 font-semibold tracking-[0.06em] ${alignClass} ${
          sorted ? "text-[var(--c-accent)]" : "hover:text-[var(--c-text)]"
        }`}
      >
        {children}
        <span aria-hidden="true">
          {sorted ? (sorted === "descending" ? " ↓" : " ↑") : ""}
        </span>
      </button>
    </th>
  );
}
