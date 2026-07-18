import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { fmtFull, fmtNum } from "@/lib/format";
import { calculateDecisionReviewMetrics } from "@/lib/decision-review-metrics";
import { getUnreadCount } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/server";
import { archiveDecision } from "../actions";
import { ReviewForm } from "./ReviewForm";

type ReviewRow = {
  hypothesis_outcome: string;
  catalyst_outcome: string;
  risk_outcome: string;
  plan_followed: boolean;
  asset_return_pct: number | null;
  twd_return_pct: number | null;
  fx_effect_pct: number | null;
  max_favorable_excursion_pct: number | null;
  max_adverse_excursion_pct: number | null;
  decision_quality: number;
  reflection: string;
  next_improvement: string;
};

type DecisionRow = {
  id: string;
  account_id: string | null;
  transaction_id: string | null;
  decision_date: string;
  asset_name: string;
  symbol: string | null;
  decision_type: string;
  thesis: string;
  catalysts: string;
  risks: string;
  invalidation_conditions: string;
  expected_holding_months: number;
  target_return_min_pct: number | null;
  target_return_max_pct: number | null;
  max_drawdown_pct: number | null;
  confidence: number;
  review_date: string;
  tags: string[];
  status: string;
  context_snapshot: DecisionSnapshot;
  accounts: { name: string } | null;
  decision_reviews: ReviewRow[] | null;
};

type DecisionSnapshot = {
  captured_at?: string;
  timezone?: string;
  portfolio?: { value_twd?: number; active_account_count?: number };
  account?: {
    name?: string;
    value_twd?: number;
    allocation_pct?: number | null;
    cost_basis_twd?: number;
    unrealized_pnl_twd?: number | null;
    realized_pnl_twd?: number;
    last_priced_at?: string | null;
    status?: string;
  } | null;
  data_gaps?: string[];
};

const typeLabels: Record<string, string> = {
  buy: "買進",
  add: "加碼",
  reduce: "減碼",
  sell: "賣出",
  hold: "續抱",
  avoid: "不採取",
};

export default async function DecisionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [
    {
      data: { user },
    },
    unreadCount,
    { data },
  ] = await Promise.all([
    supabase.auth.getUser(),
    getUnreadCount(),
    supabase
      .from("investment_decisions")
      .select(
        "id,account_id,transaction_id,decision_date,asset_name,symbol,decision_type,thesis,catalysts,risks,invalidation_conditions,expected_holding_months,target_return_min_pct,target_return_max_pct,max_drawdown_pct,confidence,review_date,tags,status,context_snapshot,accounts(name),decision_reviews(hypothesis_outcome,catalyst_outcome,risk_outcome,plan_followed,asset_return_pct,twd_return_pct,fx_effect_pct,max_favorable_excursion_pct,max_adverse_excursion_pct,decision_quality,reflection,next_improvement)",
      )
      .eq("id", id)
      .single(),
  ]);
  if (!data) notFound();
  const decision = data as unknown as DecisionRow;
  const review = decision.decision_reviews?.[0] ?? null;
  const snapshot = decision.context_snapshot ?? {};
  const { data: reviewSnapshots } = decision.account_id
    ? await supabase
        .from("account_snapshots")
        .select("snapshot_date,unit_price,fx_rate")
        .eq("account_id", decision.account_id)
        .lte("snapshot_date", decision.review_date)
        .order("snapshot_date", { ascending: true })
        .limit(2_000)
    : { data: [] };
  const suggestedMetrics = calculateDecisionReviewMetrics({
    decisionDate: decision.decision_date,
    reviewDate: decision.review_date,
    snapshots: (reviewSnapshots ?? []).map((row) => ({
      date: row.snapshot_date,
      unitPrice: row.unit_price == null ? null : Number(row.unit_price),
      fxRate: row.fx_rate == null ? null : Number(row.fx_rate),
    })),
  });

  return (
    <div className="min-h-screen bg-[var(--c-page)] text-[var(--c-text)]">
      <AppHeader active="decisions" userEmail={user?.email} unreadCount={unreadCount} />
      <main className="mx-auto max-w-[920px] px-4 pb-28 pt-9 sm:px-6">
        <Link href="/decisions" className="text-[13px] text-[var(--c-muted)] hover:text-[var(--c-accent)]">
          ← 決策日誌
        </Link>
        <header className="mt-4 flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-[var(--c-accent-soft)] px-2 py-1 text-[11.5px] font-semibold text-[var(--c-accent)]">
                {typeLabels[decision.decision_type] ?? decision.decision_type}
              </span>
              <span className="text-[12px] text-[var(--c-muted)] tnum">{decision.decision_date}</span>
            </div>
            <h1 className="mt-2 font-serif text-3xl font-medium tracking-tight">
              {decision.asset_name}{decision.symbol ? ` · ${decision.symbol}` : ""}
            </h1>
            <p className="mt-1 text-[12.5px] text-[var(--c-muted)]">
              {decision.accounts?.name ?? "未連結帳戶"} · 信心 {decision.confidence}/3 · 預定檢討 {decision.review_date}
            </p>
          </div>
          {decision.status !== "archived" && (
            <form action={archiveDecision}>
              <input type="hidden" name="decisionId" value={decision.id} />
              <button className="rounded-[var(--r-control)] border border-[var(--c-border)] px-3.5 py-2 text-[12.5px] text-[var(--c-muted)] hover:bg-[var(--c-surface-soft)]">
                封存
              </button>
            </form>
          )}
        </header>

        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <TextCard title="投資論點" text={decision.thesis} />
          <TextCard title="失效條件" text={decision.invalidation_conditions} tone="warning" />
          <TextCard title="可能催化劑" text={decision.catalysts || "未填寫"} />
          <TextCard title="主要風險" text={decision.risks} tone="warning" />
        </section>

        <section className="mt-4 rounded-[var(--r-card)] border border-[var(--c-border)] bg-[var(--c-surface)] p-5 sm:p-6">
          <h2 className="font-serif text-xl font-medium">事前預期</h2>
          <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Metric label="持有期間" value={`${decision.expected_holding_months} 個月`} />
            <Metric label="目標報酬" value={returnRange(decision.target_return_min_pct, decision.target_return_max_pct)} />
            <Metric label="可接受跌幅" value={decision.max_drawdown_pct == null ? "未設定" : `${fmtNum(decision.max_drawdown_pct, 2)}%`} />
            <Metric label="狀態" value={decision.status === "reviewed" ? "已檢討" : decision.status === "archived" ? "已封存" : "追蹤中"} />
          </dl>
          {decision.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {decision.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-[var(--c-surface-soft)] px-2.5 py-1 text-[11.5px] text-[var(--c-muted)]">{tag}</span>
              ))}
            </div>
          )}
        </section>

        <SnapshotCard snapshot={snapshot} transactionId={decision.transaction_id} />

        <section className="mt-5 rounded-[var(--r-card)] border border-[var(--c-border)] bg-[var(--c-surface)] p-5 sm:p-6">
          <div>
            <h2 className="font-serif text-xl font-medium">事後檢討</h2>
            <p className="mt-1 text-[12.5px] text-[var(--c-muted)]">
              評估決策流程與證據，不以單次盈虧替代判斷品質。
            </p>
          </div>
          <ReviewForm
            decisionId={decision.id}
            initial={review}
            suggested={suggestedMetrics}
          />
        </section>
      </main>
    </div>
  );
}

function TextCard({ title, text, tone }: { title: string; text: string; tone?: "warning" }) {
  return (
    <article className={`rounded-[var(--r-card)] border bg-[var(--c-surface)] p-5 ${tone === "warning" ? "border-[color-mix(in_srgb,var(--c-down)_25%,var(--c-border))]" : "border-[var(--c-border)]"}`}>
      <h2 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--c-muted)]">{title}</h2>
      <p className="mt-2 whitespace-pre-wrap text-[14px] leading-6">{text}</p>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11.5px] text-[var(--c-muted)]">{label}</dt>
      <dd className="mt-1 text-[14px] font-semibold tnum">{value}</dd>
    </div>
  );
}

function SnapshotCard({ snapshot, transactionId }: { snapshot: DecisionSnapshot; transactionId: string | null }) {
  const account = snapshot.account;
  return (
    <section className="mt-5 rounded-[var(--r-card)] border border-[var(--c-border)] bg-[var(--c-surface)] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-xl font-medium">建立時情境</h2>
          <p className="mt-1 text-[11.5px] text-[var(--c-muted)]">
            不可變快照 · {snapshot.captured_at ? new Date(snapshot.captured_at).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" }) : "時間缺失"}
          </p>
        </div>
        {transactionId && <Link href="/activity" className="text-[12.5px] text-[var(--c-accent)] hover:underline">查看關聯活動</Link>}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Metric label="組合估值" value={`NT$ ${fmtFull(Number(snapshot.portfolio?.value_twd ?? 0))}`} />
        <Metric label="帳戶估值" value={account?.value_twd == null ? "資料不足" : `NT$ ${fmtFull(Number(account.value_twd))}`} />
        <Metric label="配置比重" value={account?.allocation_pct == null ? "資料不足" : `${fmtNum(account.allocation_pct, 2)}%`} />
        <Metric label="未實現損益" value={account?.unrealized_pnl_twd == null ? "資料不足" : `NT$ ${fmtFull(account.unrealized_pnl_twd)}`} />
      </dl>
      {snapshot.data_gaps && snapshot.data_gaps.length > 0 && (
        <div className="mt-4 rounded-lg bg-[color-mix(in_srgb,var(--c-down)_8%,var(--c-surface-soft))] px-4 py-3 text-[12px] text-[var(--c-muted)]">
          <div className="font-semibold text-[var(--c-down)]">資料缺口</div>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {snapshot.data_gaps.map((gap) => <li key={gap}>{gap}</li>)}
          </ul>
        </div>
      )}
    </section>
  );
}

function returnRange(min: number | null, max: number | null): string {
  if (min == null && max == null) return "未設定";
  if (min != null && max != null) return `${fmtNum(min, 2)}% ～ ${fmtNum(max, 2)}%`;
  return `${fmtNum(min ?? max, 2)}%`;
}
