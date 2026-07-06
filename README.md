# StackWorth

A personal portfolio tracker for a long-term investor holding US ETFs, Taiwan stocks, crypto, and manual assets across multiple accounts — everything in one TWD-denominated dashboard.

**Live app:** https://portfolio-tracker-two-rho.vercel.app · **Public demo (no login):** https://portfolio-tracker-two-rho.vercel.app/demo · **Full reference:** [docs/REFERENCE.md](docs/REFERENCE.md)

Personal finance tool. Not investment advice, not affiliated with any institution, not a commercial product.

---

## The problem

Holding assets across markets and currencies means brokerage apps only ever show fragments. Spreadsheets can't pull live prices or keep a clean contribution history. What I wanted did not exist in one place: XIRR and TWR side by side, computed with correct sign conventions, scoped to the portfolio I actually hold today, in my own base currency.

## Constraints

- **The data is my real money.** Correctness beats features; a plausible-looking wrong number is worse than "—".
- **Free-tier quote APIs** (Twelve Data, FinMind, CoinGecko) with hard rate and history limits — refresh paths need cooldowns, degraded states, and honest gaps instead of interpolated fiction.
- **Daily driver on a phone.** Touch scrubbing on charts, PWA install, one-tap amount masking for public places.
- **Solo project.** Every write path, metric, and edge case has to be cheap to verify — hence the four-gate discipline below.

## Design decisions

**One computation pipeline, two callers.** All dashboard math lives in `buildDashboardData`, a pure function with no I/O. The production page feeds it Supabase rows; the public `/demo` route feeds it deterministically generated data. The demo is therefore not a mockup — XIRR, TWR, Sharpe, and drawdown on the demo page are computed by the exact code that runs on my real portfolio.

**XIRR and TWR deliberately use opposite cashflow conventions.** XIRR follows the investor's wallet (investment = negative, terminal portfolio value appended as positive); TWR follows the portfolio (contribution = positive, terminal value excluded because it is already embedded in the last snapshot — including it would zero out the final sub-period). The sign flip happens once, at one documented point, with regression tests pinning the terminal-value misuse case.

**A solver result must be a root, or it must be null.** The Newton-Raphson XIRR solver verifies `|NPV(rate)|` against a scale-relative tolerance on every exit path. Oscillation, flat derivatives, or hitting the iteration cap all return null rather than leaking a residual that looks like a real annualized return.

**The dashboard means "the portfolio I hold today."** Totals, the trend curve, performance metrics, income stats, and allocation are all scoped to active accounts with one consistent boundary. Archiving an account cannot show up as a phantom crash in TWR.

**Failure states are designed, not defaulted.** Benchmark APIs return empty on failure and the chart bridges gaps with a visible dashed segment; CoinGecko's 365-day history cap renders BTC as an honestly late-starting series; the service worker caches nothing but an offline page, because stale financial numbers are worse than a failed load; a data-health card in settings turns red when the price cron misses a run.

## Guarding against my own mistakes

- Every server action input passes a Zod schema before touching the database; Supabase RLS and TOTP MFA (AAL2) sit under that.
- Four local gates before any commit — lint, typecheck, Vitest, build — mirrored in GitHub Actions.
- Tests target invariants, not coverage numbers: the XIRR root guarantee, TWR cashflow isolation, demo-data determinism ("regenerating tomorrow must not rewrite yesterday"), server-action auth/cooldown boundaries.
- All calendar-date conversions pin `Asia/Taipei` explicitly, because Vercel runs in UTC and a silent one-day shift in snapshot dates corrupts day-change and TWR.

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

Gates: `npm run lint` / `typecheck` / `test` / `build`.

## Status and next steps

Running in production (Vercel + Supabase, single user). CI green on every push to main. Recently shipped: public demo route, amount masking, manual refresh with cooldown, PWA install, BTC benchmark, data-health card, and atomic write paths — every account mutation now goes through a single Postgres RPC (`apply_account_mutation`, transaction-per-call), with integration tests running against a real Postgres in CI.

Next: per-account TWR charts; broader CSV import formats; idempotency guard on recurring-plan execution.

## Author

Built by [@zhuang060329-bit](https://github.com/zhuang060329-bit) as a daily-use tool for a multi-asset, multi-currency portfolio.
