# Reference

Supporting detail for [StackWorth](../README.md): full feature inventory, stack, architecture, financial-logic notes, and environment variables. The README stays focused on the case study; this file holds the lists.

---

## Key Features

- **Portfolio dashboard** — net worth in TWD, XIRR (cash-flow weighted), TWR (time-weighted), Sharpe ratio, max drawdown, unrealized/realized P&L
- **Multi-market accounts** — US stocks/ETFs (Twelve Data), Taiwan stocks (FinMind), crypto (CoinGecko), and manual accounts
- **Allocation targets and drift** — set target % per account; dashboard shows actual vs target with drift warnings
- **Net worth trend chart** — daily snapshots, 1M / 3M / 6M / YTD / 1Y / ALL range selector
- **Performance chart** — indexed return vs SPY / QQQ (FX-adjusted to TWD), Taiwan 0050, and BTC; enabled lines share one comparison start date
- **Recurring contribution plans** — scheduled monthly DCA, executed by Vercel Cron
- **Income tracking** — dividends, interest; separated from capital contributions in cashflow records
- **What-if simulator** — "what if I had put everything into VT / 0050 instead?" — replays your actual cashflow history against any ticker's historical price series
- **Alerts** — price threshold and allocation drift alerts, scanned on each cron run
- **Activity log** — full transaction history with CSV export and CSV bulk import
- **Active vs archived accounts** — all summary metrics remain scoped to active accounts; the archived toggle only expands the holdings ledger
- **MFA** — TOTP second factor enforced at AAL2 for all authenticated routes
- **Dark mode** — CSS variable system with `[data-theme="dark"]` toggle

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
| Testing | Vitest unit tests + real-Postgres integration tests |
| Error tracking | Sentry (client error boundary; no-op if DSN not set) |
| Deployment | Vercel Hobby |
| CI | GitHub Actions: lint, typecheck, unit tests, Postgres integration, build |
| Scheduled jobs | Vercel Cron (daily 06:00 UTC = 14:00 Taipei) |
| Quote sources | Twelve Data (US stocks, USD/TWD), FinMind (Taiwan stocks, historical FX), CoinGecko (crypto) |

---

## Architecture

```
src/
├── app/
│   ├── page.tsx                    ← Dashboard I/O: Supabase rows + benchmark fetches
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
│   ├── dashboard-data.ts           ← Shared pure dashboard computation pipeline
│   ├── xirr.ts                     ← Newton-Raphson XIRR solver
│   ├── metrics.ts                  ← TWR, cashflow-adjusted drawdown, interval-aware Sharpe
│   ├── whatif.ts                   ← Buy-and-hold simulation
│   ├── contributions.ts            ← Shared DCA helper (used by user actions + cron)
│   ├── prices/                     ← Quote adapters per market
│   └── schemas/action/             ← Zod schemas for server action inputs
└── proxy.ts                        ← Auth proxy (replaces Next.js Middleware in v16)
```

---

## Financial Logic & Data Integrity

**Active portfolio boundary**
- Net worth, cost basis, realized/unrealized P&L, XIRR, TWR, risk metrics, income, trend data, and allocation all use the active account set
- Showing archived accounts only adds rows to the holdings ledger; it cannot alter summary numbers or performance history

**XIRR cashflow sign convention**
- Investments use negative cashflow (money leaving the investor); terminal active-portfolio value is appended as a positive cashflow at calculation time
- `computeXirr` in `src/lib/xirr.ts` validates the residual before returning a rate
- XIRR remains hidden until its cashflow span reaches 90 days

**TWR cashflow convention — opposite sign from XIRR**
- TWR treats contributions as positive and withdrawals as negative
- Terminal value is excluded from TWR cashflows because it is already embedded in the last snapshot value
- Cumulative TWR appears after enough daily snapshots exist; annualized TWR remains hidden until the history span is long enough to avoid misleading extrapolation

**Maximum drawdown**
- Drawdown is calculated from the TWR index rather than raw net-worth snapshots
- Contributions and withdrawals therefore cannot create or conceal a market drawdown

**Sharpe ratio**
- Irregular snapshot intervals are converted to equivalent daily returns before calculating volatility
- Annualization uses calendar days because the portfolio can contain assets that trade seven days a week

**Benchmark comparison**
- SPY and QQQ daily closes are converted to TWD with historical USD/TWD rates
- Each enabled line must have data on the common comparison start date before all lines are normalized to 100
- Missing quote dates remain visible as gaps or forward-filled market-closure dates according to the chart's data rules

**Backdated transaction price warning**
- Buy, sell, and income actions detect backdated entries and ask for the actual execution price when appropriate

**Future transaction rejection**
- Write-path schemas reject future dates against the Asia/Taipei calendar date

**Atomic account writes**
- Account patch, transaction insert, and snapshot upserts run inside `apply_account_mutation`
- The Postgres function uses `security invoker` with RLS; a failure in any operation rolls back the entire mutation

**Asia/Taipei calendar boundary**
- Snapshot dates, cashflow dates, ranges, YTD, and rolling-period calculations use explicit calendar-date handling rather than UTC string truncation

---

## Verification Commands

```bash
npm run lint
npm run typecheck
npm run test:unit
TEST_DATABASE_URL=postgresql://... npm run test:integration
npm run build
```

The integration suite applies `supabase/test-schema.sql` and `supabase/rpc-mutations.sql` to a real Postgres instance before exercising the database functions.

---

## Environment Variables

A `.env.local.example` file is committed as a blank template. Copy it to `.env.local` and fill in local values:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable/public key |
| `SUPABASE_SECRET_KEY` | Server-only secret key — used in cron route and admin actions (bypasses RLS) |
| `TWELVE_DATA_API_KEY` | US stock quotes + USD/TWD FX rate |
| `FINMIND_TOKEN` | Taiwan stock quotes + historical FX |
| `CRON_SECRET` | Bearer token that protects `/api/cron/refresh` |
| `SENTRY_DSN` | (Optional) Sentry DSN for server/edge — SDK is a no-op if not set |
| `NEXT_PUBLIC_SENTRY_DSN` | (Optional) Sentry DSN for the browser — client-side capture is off without it |
| `ADMIN_EMAILS` | Comma-separated admin emails — no admin exists if unset |

Never commit `.env.local`. It is already in `.gitignore`.
