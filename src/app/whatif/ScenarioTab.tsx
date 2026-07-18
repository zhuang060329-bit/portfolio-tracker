"use client";

import { useMemo, useRef, useState } from "react";
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
      { id: "risk-price", kind: "price", scope: "all", target: null, changePct: -20 },
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
      <div className="rounded-2xl border border-dashed border-[var(--c-border)] bg-[var(--c-surface)] px-6 py-12 text-center text-sm text-[var(--c-muted)]">
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

  return (
    <div className="space-y-5">
      <section className="rounded-[var(--r-card)] border border-[var(--c-border)] bg-[var(--c-surface)] p-5 shadow-[var(--c-shadow)] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[19px] font-medium">壓力規則</h2>
            <p className="mt-1 text-[12.5px] text-[var(--c-muted)]">可套用範本，再疊加自訂價格或匯率衝擊。</p>
          </div>
          <button type="button" onClick={() => setShocks([])} className="rounded-lg border border-[var(--c-border)] px-3 py-2 text-[12px] text-[var(--c-muted)] hover:bg-[var(--c-surface-soft)]">
            清除規則
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {templates.map((template) => (
            <button
              key={template.label}
              type="button"
              onClick={() => setShocks(template.shocks.map((shock) => ({ ...shock })))}
              className="rounded-full border border-[var(--c-border)] bg-[var(--c-surface-soft)] px-3 py-1.5 text-[12.5px] hover:border-[var(--c-accent)] hover:text-[var(--c-accent)]"
            >
              {template.label}
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-3 rounded-xl bg-[var(--c-surface-soft)] p-4 sm:grid-cols-[1.4fr_0.7fr_0.7fr_auto] sm:items-end">
          <label className="text-[11.5px] text-[var(--c-muted)]">
            套用範圍
            <select value={scopeValue} onChange={(event) => setScopeValue(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-[var(--c-border)] bg-[var(--c-surface)] px-3 text-[13px] text-[var(--c-text)]">
              <option value="all::">全部持倉</option>
              {data.holdings.map((holding) => <option key={holding.id} value={`account::${holding.id}`}>帳戶 · {holding.name}</option>)}
              {unique(data.holdings.map((holding) => holding.assetClass)).map((value) => <option key={`class-${value}`} value={`asset_class::${value}`}>類別 · {ASSET_CLASS_LABEL[value] ?? value}</option>)}
              {unique(data.holdings.map((holding) => holding.market)).map((value) => <option key={`market-${value}`} value={`market::${value}`}>市場 · {MARKET_LABEL[value] ?? value}</option>)}
              {unique(data.holdings.map((holding) => holding.currency)).map((value) => <option key={`currency-${value}`} value={`currency::${value}`}>幣別 · {value}</option>)}
            </select>
          </label>
          <NumberInput label="價格衝擊（%）" value={priceChange} onChange={setPriceChange} min={-100} max={300} />
          <NumberInput label="匯率衝擊（%）" value={fxChange} onChange={setFxChange} min={-100} max={300} />
          <button type="button" onClick={addCustomShock} className="h-10 rounded-lg bg-[var(--c-accent)] px-4 text-[13px] font-semibold text-[var(--c-btn-strong-text)] hover:brightness-110">
            加入
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2" aria-label="目前壓力規則">
          {shocks.length === 0 ? (
            <span className="text-[12px] text-[var(--c-faint)]">目前沒有衝擊規則。</span>
          ) : (
            shocks.map((shock) => (
              <button
                key={shock.id}
                type="button"
                onClick={() => setShocks((current) => current.filter((item) => item.id !== shock.id))}
                aria-label={`移除 ${shockLabel(shock, data.holdings)}`}
                className="rounded-lg border border-[var(--c-border)] px-2.5 py-1.5 text-[11.5px] text-[var(--c-muted)] hover:border-[var(--c-down)] hover:text-[var(--c-down)]"
              >
                {shockLabel(shock, data.holdings)} ×
              </button>
            ))
          )}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ResultCard label="目前估值" value={result.currentTotalTwd} />
        <ResultCard label="壓力後估值" value={result.stressedTotalTwd} />
        <ResultCard label="壓力損益" value={result.stressChangeTwd} signed tone />
        <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-3">
          <div className="text-[11px] text-[var(--c-muted)]">壓力變動率</div>
          <div className={`mt-1 text-[18px] font-semibold tnum ${result.stressChangePct < 0 ? "text-[var(--c-down)]" : "text-[var(--c-up)]"}`}>
            {result.stressChangePct > 0 ? "+" : ""}{(result.stressChangePct * 100).toFixed(2)}%
          </div>
        </div>
      </section>

      <section className="rounded-[var(--r-card)] border border-[var(--c-border)] bg-[var(--c-surface)] p-5 sm:p-6">
        <h2 className="text-[19px] font-medium">買前 anti-FOMO 檢核</h2>
        <p className="mt-1 text-[12.5px] text-[var(--c-muted)]">試買只改變本頁試算，不會寫回帳戶或交易。</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1.2fr_1fr_auto] sm:items-end">
          <label className="text-[11.5px] text-[var(--c-muted)]">
            試買帳戶
            <select value={buyAccountId} onChange={(event) => setBuyAccountId(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-[var(--c-border)] bg-[var(--c-surface-soft)] px-3 text-[13px] text-[var(--c-text)]">
              {data.holdings.map((holding) => <option key={holding.id} value={holding.id}>{holding.name}{holding.symbol ? ` · ${holding.symbol}` : ""}</option>)}
            </select>
          </label>
          <NumberInput label="外部新增金額（TWD）" value={buyAmountTwd} onChange={setBuyAmountTwd} min={0} max={1_000_000_000} step={1000} />
          <div className="amt pb-2 text-right text-[12px] text-[var(--c-muted)]">買後 NT$ {fmtFull(result.finalTotalTwd)}</div>
        </div>
        {selected && (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <GuardFact
              label="單一持倉集中度"
              value={`${fmtNum(selected.finalWeightPct, 2)}% / 上限 ${fmtNum(data.concentrationLimitPct, 2)}%`}
              warning={selected.finalWeightPct > data.concentrationLimitPct}
            />
            <GuardFact
              label="類別目標偏離"
              value={
                data.allocationTargets[selected.assetClass] == null
                  ? "未設定此類別目標"
                  : `${deviations[selected.assetClass] > 0 ? "+" : ""}${fmtNum(deviations[selected.assetClass], 2)} 個百分點`
              }
              warning={(deviations[selected.assetClass] ?? 0) > 0}
            />
            <GuardFact label="近 30 日加碼" value={`${data.recentAddsByAccount[selected.id] ?? 0} 次`} warning={(data.recentAddsByAccount[selected.id] ?? 0) > 0} />
            <GuardFact label="待檢討決策" value={`${data.openDecisionsByAccount[selected.id] ?? 0} 筆`} warning={(data.openDecisionsByAccount[selected.id] ?? 0) > 0} />
            <GuardFact label="目前壓力結果" value={`${result.stressChangePct > 0 ? "+" : ""}${(result.stressChangePct * 100).toFixed(2)}%`} warning={result.stressChangePct < 0} />
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-[var(--r-card)] border border-[var(--c-border)] bg-[var(--c-surface)]">
        <div className="border-b border-[var(--c-border)] px-5 py-4">
          <h2 className="text-[17px] font-medium">持倉前後權重</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[660px] text-left text-[13px]">
            <thead className="bg-[var(--c-surface-soft)] text-[11.5px] text-[var(--c-muted)]">
              <tr><th className="px-5 py-3 font-medium">持倉</th><th className="px-3 py-3 text-right font-medium">目前估值</th><th className="px-3 py-3 text-right font-medium">壓力後</th><th className="px-3 py-3 text-right font-medium">目前權重</th><th className="px-5 py-3 text-right font-medium">買後權重</th></tr>
            </thead>
            <tbody>
              {result.holdings.map((holding) => (
                <tr key={holding.id} className="border-t border-[var(--c-border)] first:border-t-0">
                  <td className="px-5 py-3.5 font-medium">{holding.name}{holding.symbol ? ` · ${holding.symbol}` : ""}</td>
                  <td className="amt px-3 py-3.5 text-right tnum">NT$ {fmtFull(holding.valueTwd)}</td>
                  <td className="amt px-3 py-3.5 text-right tnum">NT$ {fmtFull(holding.stressedValueTwd)}</td>
                  <td className="px-3 py-3.5 text-right tnum">{fmtNum(holding.currentWeightPct, 2)}%</td>
                  <td className="px-5 py-3.5 text-right font-semibold tnum">{fmtNum(holding.finalWeightPct, 2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <aside className="rounded-xl bg-[var(--c-surface-soft)] px-4 py-3 text-[11.5px] leading-5 text-[var(--c-muted)]">
        假設：{result.assumptions.join(" ")} 本工具只呈現數學結果與設定門檻，不構成投資建議。
      </aside>
    </div>
  );
}

function NumberInput({ label, value, onChange, min, max, step = 1 }: { label: string; value: number; onChange: (value: number) => void; min: number; max: number; step?: number }) {
  return (
    <label className="text-[11.5px] text-[var(--c-muted)]">
      {label}
      <input type="number" value={value} min={min} max={max} step={step} onChange={(event) => onChange(clampNumber(event.target.value, min, max))} className="mt-1.5 h-10 w-full rounded-lg border border-[var(--c-border)] bg-[var(--c-surface)] px-3 text-right text-[13px] text-[var(--c-text)] tnum" />
    </label>
  );
}

function ResultCard({ label, value, signed = false, tone = false }: { label: string; value: number; signed?: boolean; tone?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-3">
      <div className="text-[11px] text-[var(--c-muted)]">{label}</div>
      <div className={`amt mt-1 text-[18px] font-semibold tnum ${tone ? value < 0 ? "text-[var(--c-down)]" : "text-[var(--c-up)]" : ""}`}>
        {signed && value > 0 ? "+" : ""}NT$ {fmtFull(value)}
      </div>
    </div>
  );
}

function GuardFact({ label, value, warning }: { label: string; value: string; warning: boolean }) {
  return (
    <div className={`rounded-xl border px-3.5 py-3 ${warning ? "border-[color-mix(in_srgb,var(--c-down)_35%,var(--c-border))] bg-[color-mix(in_srgb,var(--c-down)_7%,transparent)]" : "border-[var(--c-border)] bg-[var(--c-surface-soft)]"}`}>
      <div className="text-[10.5px] text-[var(--c-muted)]">{label}</div>
      <div className={`mt-1 text-[12.5px] font-semibold ${warning ? "text-[var(--c-down)]" : ""}`}>{value}</div>
    </div>
  );
}

function shockLabel(shock: ScenarioShock, holdings: ScenarioHolding[]): string {
  const kind = shock.kind === "price" ? "價格" : "匯率";
  const change = `${shock.changePct > 0 ? "+" : ""}${shock.changePct}%`;
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
