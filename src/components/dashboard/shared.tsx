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
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-[var(--c-text)] sm:text-[17px]">
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
