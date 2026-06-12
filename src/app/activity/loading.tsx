import { AppHeader } from "@/components/AppHeader";

const sk = "sk rounded";

export default function ActivityLoading() {
  return (
    <div className="min-h-screen bg-[var(--c-page)] text-[var(--c-text)]">
      <AppHeader active="activity" />
      <main className="mx-auto max-w-[1200px] px-7 py-9 pb-28">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className={`h-8 w-32 ${sk}`} />
            <div className={`mt-2 h-3 w-64 ${sk}`} />
          </div>
          <div className={`h-10 w-28 rounded-[9px] ${sk}`} />
        </div>

        {/* chips */}
        <div className="mt-6 flex flex-wrap gap-2">
          {[16, 14, 12, 12, 10].map((w, i) => (
            <div
              key={i}
              className={`h-8 rounded-full ${sk}`}
              style={{ width: `${w * 6}px` }}
            />
          ))}
        </div>

        {/* toolbar */}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <div className={`h-11 flex-1 rounded-[11px] ${sk}`} />
          <div className={`h-11 rounded-[11px] sm:w-80 ${sk}`} />
        </div>

        {/* ledger */}
        <div className="mt-7 flex flex-col gap-6">
          {[0, 1].map((g) => (
            <div key={g}>
              <div className="flex items-center justify-between py-3 sm:pl-14">
                <div className={`h-4 w-32 ${sk}`} />
                <div className={`h-3 w-24 ${sk}`} />
              </div>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="grid grid-cols-[40px_1fr] sm:grid-cols-[56px_1fr]"
                >
                  <div className="flex justify-center pt-3.5">
                    <div className={`h-6 w-6 rounded-full sm:h-7 sm:w-7 ${sk}`} />
                  </div>
                  <div className="ml-1 border-b border-[var(--c-border)] py-3">
                    <div className="flex items-center gap-3">
                      <div className={`h-5 w-20 rounded-md ${sk}`} />
                      <div className={`h-4 w-28 ${sk}`} />
                      <div className={`ml-auto h-4 w-20 ${sk}`} />
                    </div>
                    <div className={`mt-2 h-3 w-48 ${sk}`} />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
