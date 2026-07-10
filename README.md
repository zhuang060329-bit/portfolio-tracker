# StackWorth

A personal portfolio tracker for a long-term investor holding US ETFs, Taiwan stocks, crypto, and manual assets across multiple accounts — everything in one TWD-denominated dashboard.

**Live app:** https://portfolio-tracker-two-rho.vercel.app · **Public demo (no login):** https://portfolio-tracker-two-rho.vercel.app/demo · **Full reference:** [docs/REFERENCE.md](docs/REFERENCE.md)

Personal finance tool. Not investment advice, not affiliated with any institution, not a commercial product.

---

## The problem

Holding assets across markets and currencies means brokerage apps only ever show fragments. Spreadsheets can't pull live prices or keep a clean contribution history. What I wanted did not exist in one place: XIRR and TWR side by side, computed with correct sign conventions, scoped to the portfolio I actually hold today, in my own base currency.

## Constraints

- **The data is my real money.** When a metric can't be computed reliably, the UI shows "—" instead of a best guess.
- **Free-tier quote APIs** (Twelve Data, FinMind, CoinGecko) with hard rate and history limits — refresh paths use cooldowns, and missing data renders as a visible gap rather than an interpolated value.
- **Daily driver on a phone.** Touch scrubbing on charts, PWA install, one-tap amount masking for public places.
- **Solo project.** Every write path, metric, and edge case has to be cheap to verify — hence the five-gate discipline below.

## Design decisions

**One computation pipeline, two callers.** All dashboard math lives in `buildDashboardData`, a pure function with no I/O. The production page feeds it Supabase rows; the public `/demo` route feeds it deterministically generated data. The demo is therefore not a mockup — XIRR, TWR, Sharpe, and drawdown on the demo page are computed by the exact code that runs on my real portfolio.

**XIRR and TWR use opposite cashflow conventions, on purpose.** XIRR follows the investor's wallet (investment = negative, terminal portfolio value appended as positive); TWR follows the portfolio (contribution = positive, terminal value excluded because it is already embedded in the last snapshot — including it would zero out the final sub-period). The sign flip happens once, at one documented point, with regression tests pinning the terminal-value misuse case.

**The XIRR solver validates its residual before returning a rate.** Every exit path of the Newton-Raphson loop checks `|NPV(rate)|` against a scale-relative tolerance; oscillation, flat derivatives, and hitting the iteration cap all return null instead of a residual value.

**Dashboard scope is the active portfolio.** Summary values, the trend curve, performance metrics, income stats, and allocation share one active-account boundary. Showing archived accounts only expands the holdings ledger; it cannot change the dashboard totals or appear as a value drop in TWR.

**Risk metrics preserve cashflow and time boundaries.** Max drawdown is calculated from the cashflow-adjusted TWR index, so withdrawals do not look like market losses. Sharpe converts irregular snapshot intervals to equivalent daily returns and annualizes on calendar days because the portfolio includes assets that trade on weekends.

**Failure states are explicit.** Benchmark fetchers return empty on failure and the chart bridges gaps with a dashed segment; enabled comparison lines share one start date before they are normalized to 100; CoinGecko's history cap renders BTC as a late-starting series; the service worker caches only an offline page, since showing stale financial numbers is worse than failing to load; a data-health card in settings turns red when the price cron misses a run.

## Verification

- Every server action input passes a Zod schema before touching the database; Supabase RLS and TOTP MFA (AAL2) sit under that.
- Five gates run before merge — lint, typecheck, unit Vitest, Postgres integration, and production build — mirrored in GitHub Actions.
- Tests target invariants: XIRR residual validation, TWR cashflow isolation, cashflow-adjusted drawdown, irregular snapshot intervals, archived-account scope, demo-data determinism, server-action auth and cooldown boundaries, and the atomic-write RPC against a real Postgres.
- Calendar-date conversions pin `Asia/Taipei` explicitly; Vercel runs in UTC, and a one-day shift in snapshot dates corrupts day-change and TWR.

## Demo

https://portfolio-tracker-two-rho.vercel.app/demo — no account needed.

Generated data: an 18-month DCA history with a seeded pseudo-random walk, a planted correction regime, one realized loss, dividends and interest. Deterministic per day, so reviewers see the same numbers on revisit. The production dashboard holds personal financial data, so screenshots are intentionally not committed; the demo exists so the product can still be reviewed end to end.

## Running locally

```bash
git clone https://github.com/zhuang060329-bit/portfolio-tracker
cd portfolio-tracker
npm install
cp .env.local.example .env.local   # fill in — see docs/REFERENCE.md for the variable table
npm run dev
```

Gates: `npm run lint` / `npm run typecheck` / `npm run test:unit` / `TEST_DATABASE_URL=... npm run test:integration` / `npm run build`.

## Status and next steps

Running in production (Vercel + Supabase, single user). CI runs lint / typecheck / unit tests / Postgres integration / build on every push to main. Recently shipped: public demo route, amount masking, manual refresh with cooldown, PWA install, BTC benchmark, data-health card, and atomic write paths — every account mutation now goes through a single Postgres RPC (`apply_account_mutation`, transaction-per-call), with integration tests running against a real Postgres in CI.

Next: per-account TWR charts; broader CSV import formats; idempotency guard on recurring-plan execution.

## Author

Built by [@zhuang060329-bit](https://github.com/zhuang060329-bit) as a daily-use tool for a multi-asset, multi-currency portfolio.
