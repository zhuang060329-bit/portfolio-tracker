# Reference

Supporting detail for [StackWorth](../README.md): full feature inventory, stack, architecture, financial-logic notes, and environment variables. The README stays focused on the case study; this file holds the lists.

---

## Key Features

- **Portfolio dashboard** — net worth in TWD, XIRR (cash-flow weighted), TWR (time-weighted), Sharpe ratio, max drawdown, unrealized/realized P&L
- **Multi-market accounts** — US stocks/ETFs (Twelve Data), Taiwan stocks (FinMind), crypto (CoinGecko), and manual accounts
- **Allocation targets and drift** — set target % per account; dashboard shows actual vs target with drift warnings
- **Net worth trend chart** — daily snapshots, 1M / 3M / 6M / 1Y / ALL range selector
- **Performance chart** — indexed return vs SPY / QQQ (FX-adjusted to TWD), Taiwan 0050, and BTC
- **Recurring contribution plans** — scheduled DCA (daily/weekly/monthly), executed by Vercel Cron
- **Income tracking** — dividends, interest; separated from capital contributions in cashflow records
- **What-if simulator** — "what if I had put everything into VT / 0050 instead?" — replays your actual cashflow history against any ticker's historical price series
- **Alerts** — price threshold and allocation drift alerts, scanned on each cron run
- **Activity log** — full transaction history with CSV export and CSV bulk import
- **Active vs archived accounts** — the dashboard is scoped to the current portfolio: archived accounts are excluded from totals, XIRR/TWR, the trend curve, income stats, and allocation
- **MFA** — TOTP second factor enforced at AAL2 for all authenticated routes
- **Dark mode** — CSS variable system with `[data-theme="dark"]` toggle

---

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
| `NEXT_PUBLIC_SENTRY_DSN` | (Optional) Sentry DSN for the browser — client-side capture is off without it (Next.js only exposes `NEXT_PUBLIC_*` to the client) |
| `ADMIN_EMAILS` | Comma-separated admin emails — no admin exists if unset |

Never commit `.env.local`. It is already in `.gitignore`.

---

