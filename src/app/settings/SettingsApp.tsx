"use client";

import Link from "next/link";
import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  setThemePref,
  useThemePref,
  type ThemePref,
} from "@/components/ThemeToggle";
import {
  setAllocationTargets,
  type FormState as AllocFormState,
} from "@/lib/profile-actions";
import { MfaSetupCard } from "./MfaSetupCard";
import { DeleteAccountSection } from "./DeleteAccountSection";

/* ============================================================
 * Settings 主應用：6 個 section + sticky scroll-spy 側欄
 * 用 callback ref pattern 收集每個 section 的 element 給 scroll-spy 用，
 * 避免 React 19 「render 中 access ref」lint 警告。
 * ============================================================ */

const NAV = [
  { id: "account", label: "帳號" },
  { id: "prefs", label: "偏好" },
  { id: "alloc", label: "配置目標" },
  { id: "security", label: "安全" },
  { id: "notif", label: "通知" },
  { id: "data", label: "資料與匯出" },
] as const;
type NavId = (typeof NAV)[number]["id"];

// jsx 設計的 5 個常用資產類別 + 預設顏色
const ALLOC_DEFS: { cls: string; label: string; color: string }[] = [
  { cls: "stock", label: "股票", color: "var(--c-accent)" },
  { cls: "fund", label: "基金", color: "#7FA8C9" },
  { cls: "crypto", label: "加密貨幣", color: "#C58BD6" },
  { cls: "precious_metal", label: "貴金屬", color: "#E0B15F" },
  { cls: "liquid_cash", label: "流動資金", color: "#7FBFA3" },
];

export type SettingsAppProps = {
  user: { email: string | null; createdAt: string | null };
  isAdmin: boolean;
  initialTargets: Record<string, number>;
};

export function SettingsApp({
  user,
  isAdmin,
  initialTargets,
}: SettingsAppProps) {
  // 用 ref 收集每個 section 的 DOM element 給 scroll-spy 用。
  // registerEl 包成穩定 callback 才不會被 react-hooks/refs 視作 render-time access。
  const elsRef = useRef<Partial<Record<NavId, HTMLElement | null>>>({});
  const [active, setActive] = useState<NavId>("account");

  const registerEl = useCallback(
    (id: NavId) => (el: HTMLElement | null) => {
      elsRef.current[id] = el;
    },
    [],
  );

  useEffect(() => {
    function onScroll() {
      const y = window.scrollY + 120;
      let cur: NavId = "account";
      for (const n of NAV) {
        const el = elsRef.current[n.id];
        if (el && el.offsetTop <= y) cur = n.id;
      }
      setActive(cur);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const jump = useCallback((id: NavId) => {
    const el = elsRef.current[id];
    if (el) window.scrollTo({ top: el.offsetTop - 84, behavior: "smooth" });
  }, []);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[180px_1fr] md:gap-7">
      {/* 側欄 nav */}
      <aside className="md:sticky md:top-20 md:self-start">
        <nav className="flex flex-row flex-wrap gap-1.5 md:flex-col md:gap-0.5">
          {NAV.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => jump(n.id)}
              className={`rounded-lg px-3 py-2 text-left text-[13.5px] font-medium transition-colors ${
                active === n.id
                  ? "bg-[var(--c-accent-soft)] text-[var(--c-accent)]"
                  : "border border-[var(--c-border)] text-[var(--c-muted)] hover:bg-[var(--c-surface-soft)] hover:text-[var(--c-text)] md:border-0"
              }`}
            >
              {n.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* 主體 6 個 section（去卡片化：帳本式分區，靠頂部分隔線）*/}
      <div className="flex min-w-0 flex-col">
        <Section id="account" title="帳號" elRef={registerEl("account")}>
          <AccountInner user={user} />
        </Section>
        <Section
          id="prefs"
          title="偏好"
          desc="外觀與顯示方式，僅影響此裝置。"
          elRef={registerEl("prefs")}
        >
          <PrefsInner />
        </Section>
        <Section
          id="alloc"
          title="配置目標"
          desc="設定各資產類別的目標占比，儀表板會以此標示偏離。"
          elRef={registerEl("alloc")}
        >
          <AllocInner initialTargets={initialTargets} />
        </Section>
        <Section
          id="security"
          title="安全"
          desc="保護登入，防止未授權存取。"
          elRef={registerEl("security")}
        >
          <MfaSetupCard />
        </Section>
        <Section
          id="notif"
          title="通知"
          desc="選擇接收提醒的管道（背後尚未接 email/push，僅顯示偏好）。"
          elRef={registerEl("notif")}
        >
          <NotifInner isAdmin={isAdmin} />
        </Section>
        <Section
          id="data"
          title="資料與匯出"
          desc="下載報表或備份資料。"
          elRef={registerEl("data")}
        >
          <DataInner />
        </Section>
        <p className="mt-9 border-t border-[var(--c-border)] pt-6 text-center text-xs text-[var(--c-faint)]">
          StackWorth · 以 TWD 為基準幣別
        </p>
      </div>
    </div>
  );
}

/* ============================================================
 * Section wrapper（用 callback ref，不用 forwardRef）
 * ============================================================ */

function Section({
  id,
  title,
  desc,
  elRef,
  children,
}: {
  id: string;
  title: string;
  desc?: string;
  elRef: (el: HTMLElement | null) => void;
  children: React.ReactNode;
}) {
  return (
    <section
      ref={elRef}
      id={id}
      style={{ scrollMarginTop: 84 }}
      className="mt-9 border-t border-[var(--c-border)] pt-7 first:mt-0 first:border-t-0 first:pt-1"
    >
      <div className="mb-4">
        <h2 className="font-serif text-[19px] font-medium tracking-tight text-[var(--c-text)]">
          {title}
        </h2>
        {desc && (
          <p className="mt-1 text-[12.5px] text-[var(--c-muted)]">{desc}</p>
        )}
      </div>
      {children}
    </section>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--c-border)] py-3.5 first-of-type:border-t-0">
      <div className="min-w-0">
        <span className="text-[14px] font-medium text-[var(--c-text)]">
          {label}
        </span>
        {hint && (
          <span className="mt-0.5 block text-[12px] text-[var(--c-muted)]">
            {hint}
          </span>
        )}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { v: T; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-[var(--r-control)] border border-[var(--c-border)] bg-[var(--c-surface-soft)] p-1">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={`whitespace-nowrap rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
            value === o.v
              ? "bg-[var(--c-surface)] text-[var(--c-text)] shadow-sm"
              : "text-[var(--c-muted)] hover:text-[var(--c-text)]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onClick}
      className={`relative h-6 w-[42px] rounded-full border transition-colors ${
        on
          ? "border-[var(--c-up)] bg-[var(--c-up)]"
          : "border-[var(--c-line-strong)] bg-[var(--c-surface-soft)]"
      }`}
    >
      <span
        className={`absolute top-[2px] block h-[18px] w-[18px] rounded-full shadow-[0_1px_2px_rgba(0,0,0,.3)] transition-transform ${
          on ? "translate-x-[20px] bg-white" : "translate-x-[2px] bg-[var(--c-text)]"
        }`}
      />
    </button>
  );
}

/* ============================================================
 * 1. Account
 * ============================================================ */

function AccountInner({ user }: { user: SettingsAppProps["user"] }) {
  const initials = getInitials(user.email);
  return (
    <>
      <div className="flex items-center gap-4 pb-4">
        <div className="flex h-[52px] w-[52px] items-center justify-center rounded-full border border-[var(--c-line-strong)] bg-[var(--c-accent-soft)] text-[18px] font-bold text-[var(--c-accent)]">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[16px] font-semibold">
            {user.email?.split("@")[0] ?? "—"}
          </div>
          <div className="mt-0.5 truncate text-[13px] text-[var(--c-muted)]">
            {user.email ?? "—"}
          </div>
        </div>
        <span className="whitespace-nowrap rounded-full border border-[color-mix(in_srgb,var(--c-accent)_30%,transparent)] bg-[var(--c-accent-soft)] px-3 py-1 text-[12px] font-semibold text-[var(--c-accent)]">
          個人版
        </span>
      </div>
      {user.createdAt && (
        <Row label="加入時間" hint="首次建立帳戶">
          <span className="tnum text-[14px] text-[var(--c-muted)]">
            {user.createdAt.slice(0, 7)}
          </span>
        </Row>
      )}
      <Row label="登出" hint="結束目前的工作階段">
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="whitespace-nowrap rounded-lg border border-[var(--c-line-strong)] bg-[var(--c-surface)] px-4 py-2 text-[13px] font-medium text-[var(--c-text)] hover:bg-[var(--c-surface-soft)]"
          >
            登出
          </button>
        </form>
      </Row>
    </>
  );
}

/* ============================================================
 * 2. Preferences
 * ============================================================ */

function PrefsInner() {
  const pref = useThemePref() ?? "system";
  // 占位：基準幣別與精簡數字 UI 完成但底層未接（影響面太廣，留下一輪）
  const [currency, setCurrency] = useState<"TWD" | "USD">("TWD");
  const [compact, setCompact] = useState(true);

  return (
    <>
      <Row label="外觀主題">
        <Segmented<ThemePref>
          value={pref}
          onChange={(v) => setThemePref(v)}
          options={[
            { v: "light", label: "淺色" },
            { v: "dark", label: "深色" },
            { v: "system", label: "跟隨系統" },
          ]}
        />
      </Row>
      <Row
        label="基準幣別"
        hint="所有資產換算的計價幣別（USD 切換尚未連動底層計算）"
      >
        <Segmented<"TWD" | "USD">
          value={currency}
          onChange={setCurrency}
          options={[
            { v: "TWD", label: "TWD" },
            { v: "USD", label: "USD" },
          ]}
        />
      </Row>
      <Row label="精簡數字" hint="大額顯示為「萬／億」（尚未套到所有頁面）">
        <Toggle on={compact} onClick={() => setCompact((v) => !v)} />
      </Row>
    </>
  );
}

/* ============================================================
 * 3. Allocation targets
 * ============================================================ */

function AllocInner({
  initialTargets,
}: {
  initialTargets: Record<string, number>;
}) {
  const initial = useMemo(() => {
    const out: Record<string, number> = {};
    for (const def of ALLOC_DEFS) {
      out[def.cls] = Number(initialTargets[def.cls] ?? 0);
    }
    return out;
  }, [initialTargets]);

  const [targets, setTargets] = useState<Record<string, number>>(initial);
  const [savedTick, setSavedTick] = useState(false);
  const sum = Object.values(targets).reduce((a, b) => a + Number(b || 0), 0);
  const ok = Math.round(sum) === 100;

  const [state, action, pending] = useActionState<AllocFormState, FormData>(
    setAllocationTargets,
    undefined,
  );

  function update(cls: string, v: string) {
    const n = v === "" ? 0 : Math.max(0, Math.min(100, Number(v)));
    setTargets((p) => ({ ...p, [cls]: n }));
    setSavedTick(false);
  }

  function reset() {
    setTargets(initial);
    setSavedTick(false);
  }

  return (
    <form
      action={(fd: FormData) => {
        for (const def of ALLOC_DEFS) {
          fd.set(`target_${def.cls}`, String(targets[def.cls] ?? 0));
        }
        action(fd);
        setSavedTick(true);
      }}
      className="flex flex-col gap-3"
    >
      {ALLOC_DEFS.map((def) => (
        <div
          key={def.cls}
          className="grid grid-cols-[auto_80px_1fr_auto] items-center gap-3"
        >
          <span
            className="h-2.5 w-2.5 rounded-[3px]"
            style={{ background: def.color }}
          />
          <span className="text-[13.5px] text-[var(--c-text)]">{def.label}</span>
          <span className="hidden h-[7px] overflow-hidden rounded bg-[var(--c-surface-soft)] sm:block">
            <span
              className="block h-full rounded transition-[width] duration-400"
              style={{
                width: `${Math.min(100, targets[def.cls] ?? 0)}%`,
                background: def.color,
              }}
            />
          </span>
          <span className="inline-flex items-center gap-1 text-[13px] text-[var(--c-muted)]">
            <input
              type="number"
              min={0}
              max={100}
              value={targets[def.cls] ?? 0}
              onChange={(e) => update(def.cls, e.target.value)}
              className="h-[34px] w-[52px] rounded-lg border border-[var(--c-border)] bg-[var(--c-surface-soft)] px-2 text-right text-[13.5px] font-semibold text-[var(--c-text)] outline-none focus:border-[color-mix(in_srgb,var(--c-accent)_50%,transparent)] focus:ring-2 focus:ring-[var(--c-accent-soft)]"
            />
            %
          </span>
        </div>
      ))}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3.5 border-t border-[var(--c-border)] pt-4">
        <span
          className={`text-[13px] ${
            ok ? "text-[var(--c-up)]" : "text-[var(--c-down)]"
          }`}
        >
          合計 <b className="tnum font-bold">{Math.round(sum)}%</b>
          {ok
            ? " ✓"
            : `（需為 100%，差 ${
                100 - Math.round(sum) > 0 ? "+" : ""
              }${100 - Math.round(sum)}）`}
        </span>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={reset}
            className="whitespace-nowrap rounded-lg border border-[var(--c-line-strong)] bg-[var(--c-surface)] px-4 py-2 text-[13px] font-medium text-[var(--c-text)] hover:bg-[var(--c-surface-soft)]"
          >
            還原
          </button>
          <button
            type="submit"
            disabled={!ok || pending}
            className="whitespace-nowrap rounded-lg bg-[var(--c-accent)] px-4 py-2 text-[13px] font-semibold text-[#1a1408] transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {pending ? "儲存中…" : "儲存目標"}
          </button>
          {savedTick && !pending && !state?.error && (
            <span className="text-[13px] font-semibold text-[var(--c-up)]">
              ✓ 已儲存
            </span>
          )}
          {state?.error && (
            <span className="text-[12px] text-[var(--c-down)]">
              {state.error}
            </span>
          )}
        </div>
      </div>
    </form>
  );
}

/* ============================================================
 * 5. Notifications
 * ============================================================ */

function NotifInner({ isAdmin }: { isAdmin: boolean }) {
  const [ch, setCh] = useState({ email: true, push: false, weekly: true });
  const t = (k: keyof typeof ch) => setCh((p) => ({ ...p, [k]: !p[k] }));
  return (
    <>
      <Row label="Email 通知" hint="警示觸發時寄到信箱（待接 Resend）">
        <Toggle on={ch.email} onClick={() => t("email")} />
      </Row>
      <Row label="瀏覽器推播" hint="即時推送到此裝置">
        <Toggle on={ch.push} onClick={() => t("push")} />
      </Row>
      <Row label="每週摘要" hint="每週一寄出組合週報">
        <Toggle on={ch.weekly} onClick={() => t("weekly")} />
      </Row>
      <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <LinkCard href="/alerts" label="警示設定" />
        <LinkCard href="/notifications" label="通知中心" />
        {isAdmin && (
          <LinkCard href="/admin/allowlist" label="使用者管理（admin）" />
        )}
      </div>
    </>
  );
}

function LinkCard({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-soft)] px-4 py-3 text-[13.5px] font-medium text-[var(--c-text)] transition-colors hover:border-[var(--c-line-strong)] hover:text-[var(--c-accent)]"
    >
      <span>{label}</span>
      <span className="text-[var(--c-muted)] group-hover:text-[var(--c-accent)]">
        →
      </span>
    </Link>
  );
}

/* ============================================================
 * 6. Data & export
 * ============================================================ */

function DataInner() {
  const yr = new Date().getFullYear();
  return (
    <>
      <Row
        label="年度稅務報表"
        hint="賣出 / 配息 / 利息整理成 CSV，供海外所得申報參考"
      >
        <form
          action="/api/export/tax-csv"
          method="GET"
          className="flex items-center gap-2.5"
        >
          <select
            name="year"
            defaultValue={yr}
            className="h-[38px] rounded-lg border border-[var(--c-border)] bg-[var(--c-surface-soft)] px-3 text-[13.5px] text-[var(--c-text)] outline-none"
          >
            {Array.from({ length: 5 }, (_, i) => yr - i).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="whitespace-nowrap rounded-lg border border-[var(--c-line-strong)] bg-[var(--c-surface)] px-4 py-2 text-[13px] font-medium text-[var(--c-text)] hover:bg-[var(--c-surface-soft)]"
          >
            ⤓ 下載 CSV
          </button>
        </form>
      </Row>
      <Row label="匯出全部資料" hint="所有帳戶與交易紀錄（CSV）">
        <a
          href="/api/export/csv"
          download
          className="whitespace-nowrap rounded-lg border border-[var(--c-line-strong)] bg-[var(--c-surface)] px-4 py-2 text-[13px] font-medium text-[var(--c-text)] hover:bg-[var(--c-surface-soft)]"
        >
          ⤓ 匯出
        </a>
      </Row>
      <DeleteAccountSection />
    </>
  );
}

/* ============================================================
 * helpers
 * ============================================================ */

function getInitials(email: string | null): string {
  if (!email) return "··";
  const at = email.indexOf("@");
  const name = at > 0 ? email.slice(0, at) : email;
  const parts = name.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}
