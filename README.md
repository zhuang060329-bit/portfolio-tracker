# StackWorth

A personal portfolio tracking web app for long-term investors who hold US ETFs, Taiwan stocks, crypto, and manual assets across multiple accounts.

**Live demo:** https://portfolio-tracker-two-rho.vercel.app

---

## Overview

StackWorth solves a specific problem: when you hold assets across different markets and currencies, standard brokerage apps give you fragmented views. This app pulls everything into a single TWD-denominated dashboard with proper return metrics, allocation drift tracking, and contribution automation.

It is a personal finance tool. It does not provide investment advice, is not affiliated with any financial institution, and is not a commercial product.

---

## Why I Built This

- Brokerage apps don't show cross-asset, cross-currency portfolio returns in a single view
- Spreadsheets can't pull live prices or track contribution history cleanly
- I wanted XIRR and TWR side-by-side, scoped correctly to active accounts, with proper cashflow sign conventions

---

## Key Features

- **Portfolio dashboard** — net worth in TWD, XIRR (cash-flow weighted), TWR (time-weighted), Sharpe ratio, max drawdown, unrealized/realized P&L
- **Multi-market accounts** — US stocks/ETFs (Twelve Data), Taiwan stocks (FinMind), crypto (CoinGecko), and manual accounts
- **Allocation targets and drift** — set target % per account; dashboard shows actual vs target with drift warnings
- **Net worth trend chart** — daily snapshots, 1M / 3M / 6M / 1Y / ALL range selector
- **Performance chart** — annualized return vs SPY / QQQ benchmark (FX-adjusted to TWD)
- **Recurring contribution plans** — scheduled DCA (daily/weekly/monthly), executed by Vercel Cron
- **Income tracking** — dividends, interest; separated from capital contributions in cashflow records
- **What-if simulator** — "what if I had put everything into VT / 0050 instead?" — replays your actual cashflow history against any ticker's historical price series
- **Alerts** — price threshold and allocation drift alerts, scanned on each cron run
- **Activity log** — full transaction history with CSV export and CSV bulk import
- **Active vs archived accounts** — archived accounts are excluded from live XIRR / allocation / drift calculations
- **MFA** — TOTP second factor enforced at AAL2 for all authenticated routes
- **Dark mode** — CSS variable system with `[data-theme="dark"]` toggle

---

## Product Screenshots

> Production screenshots will be added after the final Vercel smoke test.

## Design References

The repository includes archived design references from the UI design pass:

- Dashboard: `design-imports/claude-design/stackworth/project/screenshots/03-dash-03.png`
- What-if: `design-imports/claude-design/stackworth/project/screenshots/01-whatif-01.png`
- Alerts: `design-imports/claude-design/stackworth/project/screenshots/01-alerts-01.png`
- Mobile: `design-imports/claude-design/stackworth/project/screenshots/01-mobile.png`

These are kept as design references and are not required for the production app runtime.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16.2.6 (Turbopack, App Router) |
| Language | TypeScript 5 |
| UI | React 19, Tailwind CSS v4, Recharts |
| Auth | Supabase Auth (email/password + Google OAuth + MFA TOTP AAL2) |
| Database | Supabase Postgres + Row Level Security |
| Validation | Zod v4 |
| Testing | Vitest |
| Error tracking | Sentry (client error boundary; no-op if DSN not set) |
| Deployment | Vercel Hobby |
| CI | GitHub Actions |
| Scheduled jobs | Vercel Cron (daily 06:00 UTC = 14:00 Taipei) |
| Quote sources | Twelve Data (US stocks, USD/TWD), FinMind (Taiwan stocks, historical FX), CoinGecko (crypto) |

---

## Architecture

```
src/
├── app/
│   ├── page.tsx                    ← Dashboard server component (XIRR, TWR, Sharpe, holdings)
│   ├── accounts/[id]/              ← Account detail + server actions
│   ├── accounts/new/{stock,crypto,manual}/
│   ├── activity/                   ← Transaction log + CSV import
│   ├── alerts/                     ← Alert CRUD
│   ├── whatif/                     ← What-if simulator
│   ├── settings/                   ← Profile + tax CSV export
│   └── api/
│       ├── cron/refresh/           ← Daily price update + snapshot + alert scan
│       └── export/{csv,tax-csv}/
├── components/                     ← Dashboard, charts, allocation targets, FAB
├── lib/
│   ├── xirr.ts                     ← Newton-Raphson XIRR solver
│   ├── metrics.ts                  ← TWR, MaxDrawdown, Sharpe
│   ├── whatif.ts                   ← Buy-and-hold simulation
│   ├── contributions.ts            ← Shared DCA helper (used by user actions + cron)
│   ├── prices/                     ← Quote adapters per market
│   └── schemas/action/             ← Zod schemas for all server action inputs
└── proxy.ts                        ← Auth proxy (replaces Next.js Middleware in v16)
```

---

## Financial Logic & Data Integrity

These are the specific problems that required careful handling:

**XIRR cashflow sign convention**
- Investments use negative cashflow (money leaving the investor); terminal portfolio value appended as a positive cashflow at calculation time
- `computeXirr` in `src/lib/xirr.ts` uses Newton-Raphson with 100-iteration cap and convergence guard

**TWR / Sharpe cashflow convention — opposite sign from XIRR**
- TWR treats contributions as positive (money added to portfolio) and builds from raw `cashflow_twd` DB rows, negating the XIRR-signed values before passing to `computeTwr`
- Terminal value is deliberately excluded from TWR cashflows; it is already embedded in the last snapshot value. Including it would drive `curEx → 0` and return null

**XIRR scoped to active accounts**
- Portfolio XIRR is computed only over the active account set, using active account snapshots as terminal value. Archived accounts are excluded from both cashflow history and terminal value

**Backdated transaction price warning**
- Server actions for buy/sell/income detect when `occurredAt` differs from today and surface a warning to fill in the actual execution price rather than the current live quote

**Future `occurredAt` rejection**
- All three write-path schemas (`add-by-amount`, `sell-quantity`, `record-income`) validate `occurredAt` against today's date in Asia/Taipei timezone using `s.slice(0, 10) <= todayInTaipei`, avoiding UTC vs local offset issues from `datetime-local` inputs

**DB write error propagation**
- `accounts.update()` errors in all four account server actions (`adjustQuantity`, `adjustBalance`, `sellQuantity`, `recordIncome`) are captured and returned before any transaction/snapshot writes proceed, preventing partially committed state
- `transactions.insert()` error in `applyContribution` is captured before snapshot upserts, so snapshot writes are skipped on insert failure

**Zod runtime validation**
- All server action inputs are validated with Zod schemas before touching the database

**Asia/Taipei timezone**
- All date-to-string conversions for snapshot dates and cashflow dates use `toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" })` to match the user's local calendar date, not UTC

---

## Validation, Testing & CI

**Local verification (all four gates must pass before commit):**
```bash
npm run lint           # ESLint
npm run typecheck      # tsc --noEmit, 0 errors
npm run test           # Vitest, currently 49 tests / 6 files
npm run build          # next build (also runs tsc internally)
```

**Test coverage:**
- `src/lib/xirr.test.ts` — XIRR Newton-Raphson convergence
- `src/lib/metrics.test.ts` — TWR cashflow isolation, max drawdown, Sharpe; includes regression test for terminal-value-as-cashflow misuse
- `src/lib/whatif.test.ts` / `whatif-project.test.ts` — buy-and-hold simulation
- `src/lib/csv-import-helpers.test.ts` — CSV field sniffing and alias matching
- `src/lib/pnl.test.ts` — realized P&L calculation

No coverage percentage is claimed; no server action integration tests exist yet.

**CI (GitHub Actions on push/PR to main):**
```yaml
typecheck → test → build
```
Build uses placeholder Supabase env vars to pass the Next.js static generation step.

---

## Local Development

```bash
git clone https://github.com/zhuang060329-bit/portfolio-tracker
cd portfolio-tracker
npm install

# copy and fill environment variables
cp .env.example .env.local   # (or create .env.local manually — see Environment Variables below)

npm run dev      # starts on http://localhost:3000
```

Other scripts:
```bash
npm run typecheck    # TypeScript check only
npm run test         # run Vitest once
npm run test:watch   # Vitest watch mode
npm run build        # production build
npm run lint         # ESLint
```

---

## Environment Variables

No `.env.example` is committed. Create `.env.local` with:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key — used only in cron route and admin actions (bypasses RLS) |
| `TWELVE_DATA_API_KEY` | US stock quotes + USD/TWD FX rate |
| `FINMIND_TOKEN` | Taiwan stock quotes + historical FX |
| `CRON_SECRET` | Bearer token that protects `/api/cron/refresh` |
| `ADMIN_EMAILS` | Comma-separated admin email addresses |
| `SENTRY_DSN` | (Optional) Sentry DSN — SDK is a no-op if not set |

Never commit `.env.local`. It is already in `.gitignore`.

---

## Current Status

- Single-user personal app, running in production on Vercel
- All four local gates pass (lint, typecheck, 49 tests, build)
- GitHub Actions CI passes on every push to main
- Supabase RLS enforced on all tables
- MFA TOTP enforced at AAL2

---

## Future Improvements

- Additional historical price sources for more accurate backdated cost basis
- Account-level performance chart (per-account TWR over time)
- Bulk CSV import for more brokerage formats (currently only generic format supported)
- More chart annotations (contribution markers on trend chart)
- Integration tests for server actions against a test database
- Optional demo seed mode for portfolio showcasing without real data

---

## Author

Built by [@zhuang060329-bit](https://github.com/zhuang060329-bit) as a personal finance tool for tracking a multi-asset, multi-currency investment portfolio.
