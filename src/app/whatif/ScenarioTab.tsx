"use client";

import { useMemo, useRef, useState } from "react";
import { PICK_OFF, PICK_ON, TONE_TEXT, sign, toneCls } from "@/components/dashboard/shared";
import { Panel, Stat, StatStrip, SurveyLabel } from "@/components/survey";
import { ASSET_CLASS_LABEL, MARKET_LABEL } from "@/lib/dashboard-data";
import { fmtFull, fmtNum } from "@/lib/format";
import {
  runPortfolioScenario,
  targetDeviationPct,
  type ScenarioHolding,
  type ScenarioShock,
  type ShockScope,
} from "@/lib/scenario";

export type ScenarioData = {
  holdings: ScenarioHolding[];
  allocationTargets: Record<string, number>;
  concentrationLimitPct: number;
  recentAddsByAccount: Record<string, number>;
  openDecisionsByAccount: Record<string, number>;
};

const templates: { label: string; shocks: ScenarioShock[] }[] = [
  {
    label: "全球風險下降",
    shocks: [
      { id: "risk-fund", kind: "price", scope: "asset_class", target: "fund", changePct: -20 },
      { id: "risk-stock", kind: "price", scope: "asset_class", target: "stock", changePct: -20 },
      { id: "risk-crypto", kind: "price", scope: "asset_class", target: "crypto", changePct: -20 },
      { id: "risk-metal", kind: "price", scope: "asset_class", target: "precious_metal", changePct: -20 },
      { id: "risk-other", kind: "price", scope: "asset_class", target: "other_investment", changePct: -20 },
      { id: "risk-fixed", kind: "price", scope: "asset_class", target: "fixed_asset", changePct: -20 },
      { id: "risk-receivable", kind: "price", scope: "asset_class", target: "receivable", changePct: -20 },
      { id: "risk-usd", kind: "fx", scope: "currency", target: "USD", changePct: -5 },
    ],
  },
  {
    label: "台股修正",
    shocks: [{ id: "tw-correction", kind: "price", scope: "market", target: "tw", changePct: -15 }],
  },
  {
    label: "加密壓力",
    shocks: [{ id: "crypto-pressure", kind: "price", scope: "asset_class", target: "crypto", changePct: -35 }],
  },
  {
    label: "美元回落",
    shocks: [{ id: "usd-down", kind: "fx", scope: "currency", target: "USD", changePct: -8 }],
  },
];

// 欄位共用的外觀：方角、line-strong 外框，手機 44px、sm 以上 40px，跟 S2 月報與歷史頁的欄位同一套
const FIELD =
  "mt-1 block h-11 w-full border border-[var(--c-line-strong)] px-3 text-[length:var(--fs-sm)] sm:h-10";
const FIELD_LABEL = "block text-[length:var(--fs-micro)] text-[var(--c-muted)]";

export function ScenarioTab({ data }: { data: ScenarioData }) {
  const [shocks, setShocks] = useState<ScenarioShock[]>(templates[0].shocks);
  const [scopeValue, setScopeValue] = useState("all::");
  const [priceChange, setPriceChange] = useState(-10);
  const [fxChange, setFxChange] = useState(0);
  const [buyAccountId, setBuyAccountId] = useState(data.holdings[0]?.id ?? "");
  const [buyAmountTwd, setBuyAmountTwd] = useState(0);
  const sequence = useRef(0);

  const result = useMemo(
    () =>
      runPortfolioScenario({
        holdings: data.holdings,
        shocks,
        buyAccountId: buyAccountId || null,
        buyAmountTwd,
      }),
    [data.holdings, shocks, buyAccountId, buyAmountTwd],
  );
  const deviations = useMemo(
    () => targetDeviationPct({ result, targets: data.allocationTargets }),
    [result, data.allocationTargets],
  );
  const selected = result.holdings.find((holding) => holding.id === buyAccountId) ?? null;

  if (data.holdings.length === 0) {
    return (
      <div className="border border-dashed border-[var(--c-line-strong)] bg-[var(--c-surface)] px-6 py-12 text-center text-[length:var(--fs-sm)] text-[var(--c-muted)]">
        目前沒有使用中的持倉可供壓力測試。
      </div>
    );
  }

  function addCustomShock() {
    const [scope, target] = scopeValue.split("::") as [ShockScope, string];
    const additions: ScenarioShock[] = [];
    sequence.current += 1;
    if (priceChange !== 0) {
      additions.push({
        id: `custom-price-${sequence.current}`,
        kind: "price",
        scope,
        target: target || null,
        changePct: priceChange,
      });
    }
    if (fxChange !== 0) {
      additions.push({
        id: `custom-fx-${sequence.current}`,
        kind: "fx",
        scope,
        target: target || null,
        changePct: fxChange,
      });
    }
    if (additions.length > 0) setShocks((current) => [...current, ...additions].slice(0, 12));
  }

  // 目前規則剛好等於哪個範本（沒有疊加自訂衝擊）就把那顆標成選中；只影響顯示
  const activeTemplate = templates.find(
    (template) =>
      template.shocks.length === shocks.length &&
      template.shocks.every(
        (shock, i) => shocks[i]?.id === shock.id && shocks[i].changePct === shock.changePct,
      ),
  )?.label;
  const stressPct = result.stressChangePct * 100;
  const classDeviation = selected ? deviations[selected.assetClass] : undefined;

  return (
    <div className="space-y-6">
      <Panel
        title="壓力規則"
        sub="可套用範本，再疊加自訂價格或匯率衝擊。"
        action={
          <button type="button" onClick={() => setShocks([])} className="btn btn-outline btn-sm">
            清除規則
          </button>
        }
      >
        <SurveyLabel>範本</SurveyLabel>
        <div className="mt-2 flex flex-wrap gap-2">
          {templates.map((template) => {
            const on = activeTemplate === template.label;
            return (
              <button
                key={template.label}
                type="button"
                aria-pressed={on}
                onClick={() => setShocks(template.shocks.map((shock) => ({ ...shock })))}
                className={`tap-row h-9 border px-3 text-[length:var(--fs-sm)] ${
                  on ? `border-[var(--c-accent)] ${PICK_ON}` : `border-[var(--c-border)] ${PICK_OFF}`
                }`}
              >
                {template.label}
              </button>
            );
          })}
        </div>

        {/* 自訂衝擊：一條髮絲線隔開，跟範本是「先選底、再疊加」的兩步 */}
        <div className="mt-5 grid gap-3 border-t border-[var(--c-border-soft)] pt-4 sm:grid-cols-[1.4fr_0.7fr_0.7fr_auto] sm:items-end">
          <label className={FIELD_LABEL}>
            套用範圍
            <select value={scopeValue} onChange={(event) => setScopeValue(event.target.value)} className={FIELD}>
              <option value="all::">全部持倉</option>
              {data.holdings.map((holding) => <option key={holding.id} value={`account::${holding.id}`}>帳戶 · {holding.name}</option>)}
              {unique(data.holdings.map((holding) => holding.assetClass)).map((value) => <option key={`class-${value}`} value={`asset_class::${value}`}>類別 · {ASSET_CLASS_LABEL[value] ?? value}</option>)}
              {unique(data.holdings.map((holding) => holding.market)).map((value) => <option key={`market-${value}`} value={`market::${value}`}>市場 · {MARKET_LABEL[value] ?? value}</option>)}
              {unique(data.holdings.map((holding) => holding.currency)).map((value) => <option key={`currency-${value}`} value={`currency::${value}`}>幣別 · {value}</option>)}
            </select>
          </label>
          <NumberInput label="價格衝擊（%）" value={priceChange} onChange={setPriceChange} min={-100} max={300} />
          <NumberInput label="匯率衝擊（%）" value={fxChange} onChange={setFxChange} min={-100} max={300} />
          <button type="button" onClick={addCustomShock} className="h-11 btn btn-outline btn-fit sm:h-10">
            加入
          </button>
        </div>

        <div className="mt-5 flex items-baseline justify-between gap-3">
          <SurveyLabel>目前規則</SurveyLabel>
          <span className="text-[length:var(--fs-micro)] text-[var(--c-faint)] tnum">{shocks.length}／12</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-2" aria-label="目前壓力規則">
          {shocks.length === 0 ? (
            <span className="text-[length:var(--fs-micro)] text-[var(--c-faint)]">目前沒有衝擊規則。</span>
          ) : (
            shocks.map((shock) => (
              <button
                key={shock.id}
                type="button"
                onClick={() => setShocks((current) => current.filter((item) => item.id !== shock.id))}
                aria-label={`移除 ${shockLabel(shock, data.holdings)}`}
                className="tap-row group inline-flex items-center gap-2 border border-[var(--c-border)] px-2.5 py-1 text-[length:var(--fs-micro)] text-[var(--c-text)] hover:border-[var(--c-line-strong)]"
              >
                <span className="tnum">{shockLabel(shock, data.holdings)}</span>
                <span aria-hidden="true" className="text-[var(--c-faint)] group-hover:text-[var(--c-text)]">×</span>
              </button>
            ))
          )}
        </div>
      </Panel>

      <StatStrip cols={4}>
        <Stat label="目前估值" mask value={`NT$ ${fmtFull(result.currentTotalTwd)}`} />
        <Stat label="壓力後估值" mask value={`NT$ ${fmtFull(result.stressedTotalTwd)}`} />
        <Stat
          label="壓力損益"
          mask
          value={
            <span className={TONE_TEXT[toneCls(result.stressChangeTwd)]}>
              {sign(result.stressChangeTwd)}NT$ {fmtFull(Math.abs(result.stressChangeTwd))}
            </span>
          }
        />
        <Stat
          label="壓力變動率"
          value={
            <span className={TONE_TEXT[toneCls(stressPct)]}>
              {sign(stressPct)}{Math.abs(stressPct).toFixed(2)}%
            </span>
          }
        />
      </StatStrip>

      <Panel title="買前 anti-FOMO 檢核" sub="試買只改變本頁試算，不會寫回帳戶或交易。">
        <div className="grid gap-3 sm:grid-cols-[1.2fr_1fr_auto] sm:items-end">
          <label className={FIELD_LABEL}>
            試買帳戶
            <select value={buyAccountId} onChange={(event) => setBuyAccountId(event.target.value)} className={FIELD}>
              {data.holdings.map((holding) => <option key={holding.id} value={holding.id}>{holding.name}{holding.symbol ? ` · ${holding.symbol}` : ""}</option>)}
            </select>
          </label>
          <NumberInput label="外部新增金額（TWD）" value={buyAmountTwd} onChange={setBuyAmountTwd} min={0} max={1_000_000_000} step={1000} />
          {/* 讀數跟左邊兩欄一樣是「標籤在上、值在下」，值的高度對齊輸入框 */}
          <div className="sm:text-right">
            <span className={FIELD_LABEL}>買後總值</span>
            <div className="amt mt-1 flex h-11 items-center text-[length:var(--fs-sm)] font-semibold tnum sm:h-10 sm:justify-end">
              NT$ {fmtFull(result.finalTotalTwd)}
            </div>
          </div>
        </div>
        {selected && (
          <div className="mt-5 grid grid-cols-2 gap-px border border-[var(--c-border)] bg-[var(--c-border)] lg:grid-cols-5">
            <GuardFact
              label="單一持倉集中度"
              value={`${fmtNum(selected.finalWeightPct, 2)}% / 上限 ${fmtNum(data.concentrationLimitPct, 2)}%`}
              warning={selected.finalWeightPct > data.concentrationLimitPct}
            />
            <GuardFact
              label="類別目標偏離"
              value={
                classDeviation == null || data.allocationTargets[selected.assetClass] == null
                  ? "未設定此類別目標"
                  : `${sign(classDeviation)}${fmtNum(Math.abs(classDeviation), 2)} 個百分點`
              }
              warning={(classDeviation ?? 0) > 0}
            />
            <GuardFact label="近 30 日加碼" value={`${data.recentAddsByAccount[selected.id] ?? 0} 次`} warning={(data.recentAddsByAccount[selected.id] ?? 0) > 0} />
            <GuardFact label="待檢討決策" value={`${data.openDecisionsByAccount[selected.id] ?? 0} 筆`} warning={(data.openDecisionsByAccount[selected.id] ?? 0) > 0} />
            {/* 五格在手機兩欄時最後一格會落單，跨兩欄補滿，免得露出一塊底色 */}
            <GuardFact
              label="目前壓力結果"
              value={`${sign(stressPct)}${Math.abs(stressPct).toFixed(2)}%`}
              warning={result.stressChangePct < 0}
              className="col-span-2 lg:col-span-1"
            />
          </div>
        )}
      </Panel>

      <Panel title="持倉前後權重" flush>
        <p className="scroll-cue px-5 pt-2">左右滑動查看完整欄位</p>
        <div className="scroll-region overflow-x-auto" tabIndex={0} aria-label="持倉前後權重表，可水平捲動">
          <table className="w-full min-w-[660px] text-left text-[length:var(--fs-sm)]">
            <thead className="border-b border-[var(--c-line-strong)] text-[length:var(--fs-micro)] tracking-[0.06em] text-[var(--c-muted)]">
              <tr><th className="px-5 py-2.5 font-semibold">持倉</th><th className="px-3 py-2.5 text-right font-semibold">目前估值</th><th className="px-3 py-2.5 text-right font-semibold">壓力後</th><th className="px-3 py-2.5 text-right font-semibold">目前權重</th><th className="px-5 py-2.5 text-right font-semibold">買後權重</th></tr>
            </thead>
            <tbody>
              {result.holdings.map((holding) => (
                <tr key={holding.id} className="border-t border-[var(--c-border-soft)] first:border-t-0">
                  <td className="px-5 py-3 font-medium">{holding.name}{holding.symbol ? <span className="text-[var(--c-muted)]"> · {holding.symbol}</span> : ""}</td>
                  <td className="amt px-3 py-3 text-right tnum">NT$ {fmtFull(holding.valueTwd)}</td>
                  <td className="amt px-3 py-3 text-right tnum">NT$ {fmtFull(holding.stressedValueTwd)}</td>
                  <td className="px-3 py-3 text-right tnum text-[var(--c-muted)]">{fmtNum(holding.currentWeightPct, 2)}%</td>
                  <td className="px-5 py-3 text-right font-semibold tnum">{fmtNum(holding.finalWeightPct, 2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <aside className="border-t border-[var(--c-border)] pt-3 text-[length:var(--fs-micro)] leading-5 text-[var(--c-faint)]">
        假設：{result.assumptions.join(" ")} 本工具只呈現數學結果與設定門檻，不構成投資建議。
      </aside>
    </div>
  );
}

function NumberInput({ label, value, onChange, min, max, step = 1 }: { label: string; value: number; onChange: (value: number) => void; min: number; max: number; step?: number }) {
  return (
    <label className={FIELD_LABEL}>
      {label}
      <input type="number" value={value} min={min} max={max} step={step} onChange={(event) => onChange(clampNumber(event.target.value, min, max))} className={`${FIELD} text-right tnum`} />
    </label>
  );
}

/* 檢核格。觸發時不用跌色：這裡說的是「買之前停一下」，不是虧損。
   改用朱砂註記的規則——值轉成 --c-annot-text，標籤列多一條虛線引線與「注意」兩字，
   顏色之外還有字與線兩個訊號。 */
function GuardFact({ label, value, warning, className = "" }: { label: string; value: string; warning: boolean; className?: string }) {
  return (
    <div className={`bg-[var(--c-surface)] px-4 py-3 ${className}`}>
      <div className="flex items-center gap-2">
        <SurveyLabel className="shrink-0">{label}</SurveyLabel>
        {warning && (
          <>
            <span aria-hidden="true" className="h-0 min-w-3 flex-1 border-t border-dashed border-[var(--c-annot)]" />
            <span className="shrink-0 text-[length:var(--fs-micro)] font-semibold text-[var(--c-annot-text)]">注意</span>
          </>
        )}
      </div>
      <div className={`mt-1.5 text-[length:var(--fs-sm)] font-semibold tnum ${warning ? "text-[var(--c-annot-text)]" : ""}`}>{value}</div>
    </div>
  );
}

function shockLabel(shock: ScenarioShock, holdings: ScenarioHolding[]): string {
  const kind = shock.kind === "price" ? "價格" : "匯率";
  const change = `${sign(shock.changePct)}${Math.abs(shock.changePct)}%`;
  if (shock.scope === "all") return `全部 · ${kind} ${change}`;
  if (shock.scope === "account") return `${holdings.find((holding) => holding.id === shock.target)?.name ?? "帳戶"} · ${kind} ${change}`;
  if (shock.scope === "asset_class") return `${ASSET_CLASS_LABEL[shock.target ?? ""] ?? shock.target} · ${kind} ${change}`;
  if (shock.scope === "market") return `${MARKET_LABEL[shock.target ?? ""] ?? shock.target} · ${kind} ${change}`;
  return `${shock.target} · ${kind} ${change}`;
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function clampNumber(value: string, min: number, max: number): number {
  const number = value === "" ? 0 : Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : 0;
}
