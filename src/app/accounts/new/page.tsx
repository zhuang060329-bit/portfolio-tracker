import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { getUnreadCount } from "@/lib/notifications";

export default async function NewAccountIndex() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const unreadCount = await getUnreadCount();

  const items = [
    {
      href: "/accounts/new/stock",
      title: "股票",
      desc: "美股 / 台股，輸入 ticker / 代號自動驗證並抓最新價",
      icon: "▲",
    },
    {
      href: "/accounts/new/crypto",
      title: "加密貨幣",
      desc: "以 CoinGecko id（如 bitcoin）建立，CoinGecko 直接回 TWD",
      icon: "₿",
    },
    {
      href: "/accounts/new/manual",
      title: "其他投資（手動）",
      desc: "直接輸入餘額，不自動抓價（適合銀行存款、保單現金價值等）",
      icon: "$",
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--c-page)] text-[var(--c-text)]">
      <AppHeader active="accounts" userEmail={user?.email} unreadCount={unreadCount} />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="mb-4 text-sm">
          <Link href="/" className="text-[var(--c-muted)] hover:text-[var(--c-text)]">
            ← 回總覽
          </Link>
        </div>
        <header>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">
            新增帳戶
          </h1>
          <p className="mt-2 text-sm text-[var(--c-muted)]">
            選擇要新增的資產類型。流動資金 / 固定資產 / 應收款 / 負債 等其餘類別會在後續版本加入。
          </p>
        </header>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {items.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className="group flex items-center gap-3 rounded-md border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-3 shadow-sm transition-colors hover:border-[var(--c-accent)]/40 hover:bg-[var(--c-surface-soft)]"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--c-accent)]/10 text-sm font-semibold text-[var(--c-accent)]">
                {it.icon}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{it.title}</div>
                <div className="mt-0.5 line-clamp-2 text-xs text-[var(--c-muted)]">
                  {it.desc}
                </div>
              </div>
              <span className="text-[var(--c-faint)] group-hover:text-[var(--c-accent)]">
                →
              </span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
