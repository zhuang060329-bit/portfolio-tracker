import { notFound } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { getUnreadCount } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/server";
import {
  DecisionForm,
  type DecisionFormInitial,
} from "@/app/decisions/new/DecisionForm";

type DecisionEditRow = {
  id: string;
  account_id: string | null;
  transaction_id: string | null;
  decision_date: string;
  asset_name: string;
  symbol: string | null;
  decision_type: DecisionFormInitial["decisionType"];
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
};

type LinkedTransaction = {
  id: string;
  account_id: string;
  type: string;
  created_at: string;
  accounts: { name: string; symbol: string | null } | null;
};

export default async function EditDecisionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [
    {
      data: { user },
    },
    unreadCount,
    { data: decisionData },
    { data: accountData },
  ] = await Promise.all([
    supabase.auth.getUser(),
    getUnreadCount(),
    supabase
      .from("investment_decisions")
      .select("id,account_id,transaction_id,decision_date,asset_name,symbol,decision_type,thesis,catalysts,risks,invalidation_conditions,expected_holding_months,target_return_min_pct,target_return_max_pct,max_drawdown_pct,confidence,review_date,tags")
      .eq("id", id)
      .single(),
    supabase.from("accounts").select("id,name,symbol,status").order("name"),
  ]);
  if (!decisionData) notFound();
  const decision = decisionData as DecisionEditRow;
  let linkedTransaction: LinkedTransaction | null = null;
  if (decision.transaction_id) {
    const { data } = await supabase
      .from("transactions")
      .select("id,account_id,type,created_at,accounts(name,symbol)")
      .eq("id", decision.transaction_id)
      .single();
    linkedTransaction = (data as unknown as LinkedTransaction | null) ?? null;
  }
  const initial: DecisionFormInitial = {
    accountId: decision.account_id ?? "",
    decisionDate: decision.decision_date,
    assetName: decision.asset_name,
    symbol: decision.symbol ?? "",
    decisionType: decision.decision_type,
    thesis: decision.thesis,
    catalysts: decision.catalysts,
    risks: decision.risks,
    invalidationConditions: decision.invalidation_conditions,
    expectedHoldingMonths: Number(decision.expected_holding_months),
    targetReturnMinPct: nullableNumber(decision.target_return_min_pct),
    targetReturnMaxPct: nullableNumber(decision.target_return_max_pct),
    maxDrawdownPct: nullableNumber(decision.max_drawdown_pct),
    confidence: Number(decision.confidence),
    reviewDate: decision.review_date,
    tags: decision.tags.join(", "),
  };
  return (
    <div className="min-h-screen bg-[var(--c-page)] text-[var(--c-text)]">
      <AppHeader active="decisions" userEmail={user?.email} unreadCount={unreadCount} />
      <main className="mx-auto max-w-[820px] px-4 pb-28 pt-9 sm:px-6">
        <h1 className="font-serif text-3xl font-medium">編輯投資決策</h1>
        <p className="mt-1.5 text-[13px] text-[var(--c-muted)]">可修改論點、風險與檢討設定；建立時情境快照不會重新擷取或改寫。</p>
        <DecisionForm
          accounts={(accountData ?? []) as { id: string; name: string; symbol: string | null; status: string }[]}
          linkedTransaction={linkedTransaction}
          initialDecisionDate={decision.decision_date}
          initialReviewDate={decision.review_date}
          decisionId={decision.id}
          initial={initial}
        />
      </main>
    </div>
  );
}

function nullableNumber(value: number | null): number | null {
  return value == null ? null : Number(value);
}
