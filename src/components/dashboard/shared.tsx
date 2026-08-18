"use client";

export const sign = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "");
export type Tone = "up" | "down" | "flat";
export const toneCls = (n: number): Tone =>
  n > 0 ? "up" : n < 0 ? "down" : "flat";
export const TONE_TEXT: Record<Tone, string> = {
  up: "text-[var(--c-up)]",
  down: "text-[var(--c-down)]",
  flat: "text-[var(--c-muted)]",
};

export function CardHead({
  title,
  sub,
  action,
}: {
  title: string;
  sub?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    /* 這支只服務三級區塊（資產配置、績效指標）。標題壓到 14px 並收掉字重，
       是為了讓它讀起來明顯次於二級的「持倉帳本 / 淨資產趨勢」（17–18px）。
       字級差距本身就是層級訊號，不必再靠容器。 */
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-[14px] font-semibold tracking-[0.01em] text-[var(--c-muted)]">
          {title}
        </h2>
        {sub && (
          <p className="mt-1 text-[12px] leading-relaxed text-[var(--c-muted)]">
            {sub}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
