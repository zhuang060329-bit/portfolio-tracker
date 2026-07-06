"use client";

// 儀表板子模組共用的小工具與卡片標頭。

export const sign = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "");
export type Tone = "up" | "down" | "flat";
export const toneCls = (n: number): Tone => (n > 0 ? "up" : n < 0 ? "down" : "flat");
export const TONE_TEXT: Record<Tone, string> = {
  up: "text-[var(--c-up)]",
  down: "text-[var(--c-down)]",
  flat: "text-[var(--c-muted)]",
};

export function CardHead({ title, sub }: { title: string; sub?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-[19px] font-medium tracking-tight">
          {title}
        </h2>
        {sub && (
          <p className="mt-0.5 text-[12.5px] text-[var(--c-muted)]">{sub}</p>
        )}
      </div>
    </div>
  );
}
