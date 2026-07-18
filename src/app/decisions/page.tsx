import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { todayTaipei } from "@/lib/dates";
import { getUnreadCount } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/server";

type DecisionRow = {
  id: string;
  decision_date: string;
  asset_name: string;
  symbol: string | null;
  decision_type: string;
  thesis: string;
  confidence: number;
  review_date: string;
  status: string;
  tags: string[];
  accounts: { name: string } | null;
  decision_reviews: { id: string }[] | null;
};

const typeLabels: Record<string, string> = {
  buy: "買進",
  add: "加碼",
  reduce: "減碼",
  sell: "賣出",
  hold: "續抱",
  avoid: "不採取",
};

export default async function DecisionsPage() {
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
        "id,decision_date,asset_name,symbol,decision_type,thesis,confidence,review_date,status,tags,accounts(name),decision_reviews(id)",
      )
      .order("decision_date", { ascending: false }),
  ]);
  const decisions = (data ?? []) as unknown as DecisionRow[];
  const today = todayTaipei();
  const dueCount = decisions.filter(
    (decision) =>
      decision.status === "open" &&
      !decision.decision_reviews?.length &&
      decision.review_date <= today,
  ).length;

  return (
    <div className="min-h-screen bg-[var(--c-page)] text-[var(--c-text)]">
      <AppHeader active="decisions" userEmail={user?.email} unreadCount={unreadCount} />
      <main className="mx-auto max-w-[920px] px-4 pb-28 pt-9 sm:px-6 lg:px-7">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl font-medium tracking-tight">決策日誌</h1>
            <p className="mt-1.5 text-[13.5px] text-[var(--c-muted)]">
              保存當下論點、風險與失效條件，再以同一份原始情境檢討。
            </p>
          </div>
          <Link
            href="/decisions/new"
            className="rounded-[var(--r-control)] bg-[var(--c-accent)] px-4 py-2.5 text-[13.5px] font-semibold text-[var(--c-btn-strong-text)] hover:brightness-110"
          >
            ＋ 記錄決策
          </Link>
        </header>

        <section className="mt-6 grid grid-cols-2 gap-3">
          <Summary label="決策總數" value={decisions.length} />
          <Summary label="待檢討" value={dueCount} alert={dueCount > 0} />
        </section>

        {decisions.length === 0 ? (
          <section className="mt-5 rounded-[var(--r-card)] border border-[var(--c-border)] bg-[var(--c-surface)] px-6 py-12 text-center">
            <p className="text-[15px]">還沒有決策紀錄。</p>
            <p className="mt-1 text-[12.5px] text-[var(--c-muted)]">
              可從這裡建立，或從活動紀錄連結一筆交易後再填寫。
            </p>
          </section>
        ) : (
          <section className="mt-5 overflow-hidden rounded-[var(--r-card)] border border-[var(--c-border)] bg-[var(--c-surface)] shadow-[var(--c-shadow)]">
            {decisions.map((decision, index) => {
              const reviewed = Boolean(decision.decision_reviews?.length);
              const due = decision.status === "open" && !reviewed && decision.review_date <= today;
              return (
                <Link
                  key={decision.id}
                  href={`/decisions/${decision.id}`}
                  className={`block px-5 py-4 transition-colors hover:bg-[var(--c-surface-soft)] ${
                    index > 0 ? "border-t border-[var(--c-border)]" : ""
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-[var(--c-accent-soft)] px-2 py-1 text-[11.5px] font-semibold text-[var(--c-accent)]">
                      {typeLabels[decision.decision_type] ?? decision.decision_type}
                    </span>
                    <span className="text-[15px] font-semibold">{decision.asset_name}</span>
                    {decision.symbol && (
                      <span className="text-[12px] text-[var(--c-muted)]">{decision.symbol}</span>
                    )}
                    <span className="ml-auto text-[12px] text-[var(--c-faint)] tnum">
                      {decision.decision_date}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-[13px] leading-6 text-[var(--c-muted)]">
                    {decision.thesis}
                  </p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11.5px] text-[var(--c-faint)]">
                    <span>信心 {decision.confidence}/3</span>
                    {decision.accounts?.name && <span>· {decision.accounts.name}</span>}
                    <span>· 檢討 {decision.review_date}</span>
                    <span
                      className={
                        due
                          ? "rounded-full bg-[color-mix(in_srgb,var(--c-down)_12%,transparent)] px-2 py-0.5 font-semibold text-[var(--c-down)]"
                          : "rounded-full bg-[var(--c-surface-soft)] px-2 py-0.5"
                      }
                    >
                      {decision.status === "archived"
                        ? "已封存"
                        : reviewed
                          ? "已檢討"
                          : due
                            ? "檢討到期"
                            : "追蹤中"}
                    </span>
                  </div>
                </Link>
              );
            })}
          </section>
        )}
      </main>
    </div>
  );
}

function Summary({ label, value, alert = false }: { label: string; value: number; alert?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-3">
      <div className="text-[11.5px] text-[var(--c-muted)]">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tnum ${alert ? "text-[var(--c-down)]" : ""}`}>
        {value}
      </div>
    </div>
  );
}
