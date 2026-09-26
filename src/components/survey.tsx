/* 測繪桌的頁面層級元件：頁首、測量標籤、狀態標記、指標帶。
   這支檔刻意不加 "use client"——全部是無狀態的純標記，server 頁面直接用，
   client 元件 import 也照常。dashboard/shared.tsx 的 SurveyLabel 從這裡轉出。 */

/* 測量註記的標籤：前面一個 7px 的十字套準記號，後面是字。
   十字只是記號，不帶意義，所以對輔助技術隱藏。
   字仍用 Plex Sans：中文會落到 Noto Sans TC，Mono 只在數字上用。 */
export function SurveyLabel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[length:var(--fs-micro)] font-semibold tracking-[0.06em] text-[var(--c-muted)] ${className}`}
    >
      <svg width="7" height="7" viewBox="0 0 7 7" aria-hidden="true" className="shrink-0">
        <path d="M3.5 0V7M0 3.5H7" stroke="var(--c-accent)" strokeWidth="1" />
      </svg>
      {children}
    </span>
  );
}

/* 一級頁首：測量標籤 → 標題 → 說明，底下一條 line-strong 髮絲線收邊。
   右側 action 放該頁的表單或主按鈕，窄螢幕時換行到標題下方。 */
export function PageHead({
  label,
  title,
  sub,
  action,
  className = "",
}: {
  label?: React.ReactNode;
  title: React.ReactNode;
  sub?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={`flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-b border-[var(--c-line-strong)] pb-5 ${className}`}
    >
      <div className="min-w-0">
        {label && <SurveyLabel>{label}</SurveyLabel>}
        <h1
          className={`font-display text-[length:var(--fs-2xl)] font-semibold leading-tight tracking-[-0.01em] ${
            label ? "mt-2" : ""
          }`}
        >
          {title}
        </h1>
        {sub && (
          <p className="mt-1.5 max-w-2xl text-[length:var(--fs-sm)] leading-relaxed text-[var(--c-muted)]">
            {sub}
          </p>
        )}
      </div>
      {action}
    </header>
  );
}

/* 方角狀態標記。不做膠囊、不做底色塊，靠外框與字表意：
   - up：已完成、正向結果，實線綠框
   - annot：需要注意（例如檢討到期），朱砂虛線框。字用 --c-annot-text，
     因為淺色主題下朱砂本身對底不到 4.5:1，只能當框色
   - accent：分類（加碼、續抱），測量藍淡底
   - quiet：進行中、沒有要人做的事 */
export type TagTone = "up" | "annot" | "accent" | "quiet";

const TAG_TONE: Record<TagTone, string> = {
  up: "border-[var(--c-up)] text-[var(--c-up)]",
  annot: "border-dashed border-[var(--c-annot)] text-[var(--c-annot-text)]",
  accent: "border-transparent bg-[var(--c-accent-soft)] text-[var(--c-accent)]",
  quiet: "border-[var(--c-border)] text-[var(--c-muted)]",
};

export function Tag({
  tone = "quiet",
  children,
}: {
  tone?: TagTone;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center border px-1.5 py-px text-[length:var(--fs-micro)] font-semibold leading-5 ${TAG_TONE[tone]}`}
    >
      {children}
    </span>
  );
}

/* 指標帶：一排等寬格子，格與格之間是 1px 髮絲線（gap-px 透出底下的 border 色），
   跟首頁 hero 下方那排同一個作法。cols 是 sm 以上的欄數，手機固定兩欄。 */
const STRIP_COLS: Record<3 | 4 | 5, string> = {
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-4",
  5: "sm:grid-cols-5",
};

export function StatStrip({
  cols,
  children,
  className = "",
}: {
  cols: 3 | 4 | 5;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`grid grid-cols-2 gap-px border border-[var(--c-border)] bg-[var(--c-border)] ${STRIP_COLS[cols]} ${className}`}
    >
      {children}
    </section>
  );
}

export function Stat({
  label,
  value,
  sub,
  mask = false,
  className = "",
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  sub?: React.ReactNode;
  // 金額要跟著隱私模式模糊；百分比與筆數不用
  mask?: boolean;
  className?: string;
}) {
  return (
    <div className={`bg-[var(--c-surface)] px-4 py-3.5 ${className}`}>
      <SurveyLabel>{label}</SurveyLabel>
      <div
        className={`mt-1.5 text-[length:var(--fs-md)] font-semibold tnum ${mask ? "amt" : ""}`}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-1 text-[length:var(--fs-micro)] text-[var(--c-muted)]">{sub}</div>
      )}
    </div>
  );
}
