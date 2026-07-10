# Architecture

## Dashboard computation

`src/lib/dashboard-data.ts` is the pure computation boundary shared by the authenticated dashboard and the public demo. Pages perform I/O, then pass normalized rows into `buildDashboardData`.

Chart range selection and common benchmark start logic live in `src/components/dashboard/chart-data.ts`. `TrendSection.tsx` owns interaction state and rendering only.

## Account write paths

`src/app/accounts/[id]/actions.ts` is a stable re-export surface for client components. Implementations are separated by domain:

- `valuation-actions.ts`: price refresh, quantity overwrite, amount-based contribution, and manual balance changes
- `trade-actions.ts`: sales, dividends, and interest
- `lifecycle-actions.ts`: archive, unarchive, and delete
- `recurring-plan-actions.ts`: create, pause, resume, and delete recurring plans
- `recurring-execution-action.ts`: manual recurring execution through the ledger RPC
- `action-shared.ts`: authenticated account loading and path revalidation

Account mutations use `apply_account_mutation`. Recurring executions use `execute_recurring_plan_mutation`, which commits account increments, transaction, snapshot, execution ledger, and schedule advancement in one Postgres transaction.

## Verification boundary

Unit tests cover pure financial, date, validation, caller-contract, and demo invariants. Integration tests apply the test schema and RPC SQL to a real Postgres instance through `TEST_DATABASE_URL`.
