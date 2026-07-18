import { notFound } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { todayTaipei } from "@/lib/dates";
import { getUnreadCount } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/server";
import { DecisionForm } from "./DecisionForm";

type AccountOption = {
  id: string;
  name: string;
  symbol: string | null;
  status: string;
};

type LinkedTransaction = {
  id: string;
  account_id: string;
  type: string;
  created_at: string;
  accounts: { name: string; symbol: string | null } | null;
};

export default async function NewDecisionPage({
  searchParams,
}: {
  searchParams: Promise<{ transaction?: string }>;
}) {
  const { transaction } = await searchParams;
  const supabase = await createClient();
  const [
    {
      data: { user },
    },
    unreadCount,
    { data: accounts },
  ] = await Promise.all([
    supabase.auth.getUser(),
    getUnreadCount(),
    supabase
      .from("accounts")
      .select("id,name,symbol,status")
      .order("name", { ascending: true }),
  ]);

  let linked: LinkedTransaction | null = null;
  if (transaction) {
    const { data, error } = await supabase
      .from("transactions")
      .select("id,account_id,type,created_at,accounts(name,symbol)")
      .eq("id", transaction)
      .single();
    if (error || !data) notFound();
    linked = data as unknown as LinkedTransaction;
  }

  const today = todayTaipei();
  const reviewDate = addMonths(today, 6);
  const transactionDate = linked
    ? new Date(linked.created_at).toLocaleDateString("en-CA", {
        timeZone: "Asia/Taipei",
      })
    : today;

  return (
    <div className="min-h-screen bg-[var(--c-page)] text-[var(--c-text)]">
      <AppHeader active="decisions" userEmail={user?.email} unreadCount={unreadCount} />
      <main className="mx-auto max-w-[820px] px-4 pb-28 pt-9 sm:px-6">
        <header>
          <h1 className="font-serif text-3xl font-medium tracking-tight">記錄投資決策</h1>
          <p className="mt-1.5 text-[13.5px] text-[var(--c-muted)]">
            儲存時會由伺服器擷取當下持倉、配置、成本與資料缺口；情境快照之後不能改寫。
          </p>
        </header>
        <DecisionForm
          accounts={(accounts ?? []) as AccountOption[]}
          linkedTransaction={linked}
          initialDecisionDate={transactionDate}
          initialReviewDate={reviewDate}
        />
      </main>
    </div>
  );
}

function addMonths(date: string, months: number): string {
  const value = new Date(`${date}T12:00:00+08:00`);
  value.setUTCMonth(value.getUTCMonth() + months);
  return value.toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
}
