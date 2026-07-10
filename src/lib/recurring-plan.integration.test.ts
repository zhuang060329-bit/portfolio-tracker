import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Client } from "pg";

const url = process.env.TEST_DATABASE_URL;
const ACCOUNT_ID = "11111111-1111-1111-1111-111111111111";
const USER_ID = "22222222-2222-2222-2222-222222222222";
const PLAN_ID = "33333333-3333-3333-3333-333333333333";
const PLAN_2_ID = "44444444-4444-4444-4444-444444444444";
const EXECUTED_AT = "2026-07-10T02:00:00.000Z";

describe.skipIf(!url)("execute_recurring_plan_mutation (integration)", () => {
  let db: Client;
  let db2: Client;

  beforeAll(async () => {
    db = new Client({ connectionString: url });
    db2 = new Client({ connectionString: url });
    await db.connect();
    await db2.connect();
    const root = join(__dirname, "..", "..");
    await db.query(readFileSync(join(root, "supabase/test-schema.sql"), "utf8"));
    await db.query(readFileSync(join(root, "supabase/rpc-mutations.sql"), "utf8"));
  });

  afterAll(async () => {
    await db2?.end();
    await db?.end();
  });

  beforeEach(async () => {
    await db.query(
      "truncate recurring_plan_runs, recurring_plans, account_snapshots, transactions, accounts cascade",
    );
    await db.query(
      `insert into accounts (
        id, user_id, name, asset_class, price_market, symbol, quantity,
        native_currency, last_unit_price, last_fx_rate, cost_basis_twd,
        cost_basis_native, status
      ) values ($1, $2, '測試帳戶', 'fund', 'us', 'VOO', 10, 'USD', 50, 2, 1000, 500, 'active')`,
      [ACCOUNT_ID, USER_ID],
    );
    await insertPlan(db, PLAN_ID, 200);
  });

  const execute = (
    client: Client,
    planId = PLAN_ID,
    expectedRunDate = "2026-07-05",
    source = "cron",
  ) =>
    client.query(
      `select * from execute_recurring_plan_mutation(
        $1, $2, $3, $4, $5, $6, $7
      )`,
      [planId, expectedRunDate, EXECUTED_AT, 50, 2, EXECUTED_AT, source],
    );

  it("單次執行將帳戶、流水、快照、ledger 與排程日期一併提交", async () => {
    const result = (await execute(db)).rows[0];
    expect(result.executed).toBe(true);
    expect(Number(result.shares_added)).toBeCloseTo(2, 8);
    expect(Number(result.new_quantity)).toBeCloseTo(12, 8);
    expect(toDate(result.next_run_date)).toBe("2026-08-05");

    const account = (
      await db.query("select * from accounts where id = $1", [ACCOUNT_ID])
    ).rows[0];
    expect(Number(account.quantity)).toBeCloseTo(12, 8);
    expect(Number(account.cost_basis_twd)).toBe(1200);
    expect(Number(account.cost_basis_native)).toBe(600);

    const transaction = (await db.query("select * from transactions")).rows[0];
    expect(Number(transaction.cashflow_twd)).toBe(-200);
    expect(Number(transaction.quantity_after)).toBeCloseTo(12, 8);

    const snapshot = (await db.query("select * from account_snapshots")).rows[0];
    expect(toDate(snapshot.snapshot_date)).toBe("2026-07-10");
    expect(Number(snapshot.value_base)).toBe(1200);

    const run = (await db.query("select * from recurring_plan_runs")).rows[0];
    expect(toDate(run.scheduled_date)).toBe("2026-07-05");
    expect(toDate(run.executed_date)).toBe("2026-07-10");
    expect(run.transaction_id).toBe(transaction.id);

    const plan = (
      await db.query("select * from recurring_plans where id = $1", [PLAN_ID])
    ).rows[0];
    expect(toDate(plan.last_run_date)).toBe("2026-07-10");
    expect(toDate(plan.next_run_date)).toBe("2026-08-05");
  });

  it("相同 scheduled date 重試只執行一次", async () => {
    const first = (await execute(db)).rows[0];
    const second = (await execute(db)).rows[0];

    expect(first.executed).toBe(true);
    expect(second.executed).toBe(false);
    expect(toDate(second.next_run_date)).toBe("2026-08-05");
    expect(await count(db, "recurring_plan_runs")).toBe(1);
    expect(await count(db, "transactions")).toBe(1);
    expect(Number((await accountRow(db)).quantity)).toBeCloseTo(12, 8);
  });

  it("同一 plan 的並行請求由 row lock 與 ledger 唯一鍵收斂為一次", async () => {
    const [left, right] = await Promise.all([execute(db), execute(db2)]);
    const results = [left.rows[0].executed, right.rows[0].executed].sort();

    expect(results).toEqual([false, true]);
    expect(await count(db, "recurring_plan_runs")).toBe(1);
    expect(await count(db, "transactions")).toBe(1);
    expect(Number((await accountRow(db)).quantity)).toBeCloseTo(12, 8);
  });

  it("不同 plan 同帳戶並行時以帳戶 row lock 保留兩筆增量", async () => {
    await insertPlan(db, PLAN_2_ID, 300);
    const [first, second] = await Promise.all([
      execute(db, PLAN_ID),
      execute(db2, PLAN_2_ID),
    ]);

    expect(first.rows[0].executed).toBe(true);
    expect(second.rows[0].executed).toBe(true);
    expect(await count(db, "recurring_plan_runs")).toBe(2);
    expect(await count(db, "transactions")).toBe(2);
    expect(Number((await accountRow(db)).quantity)).toBeCloseTo(15, 8);
    expect(Number((await accountRow(db)).cost_basis_twd)).toBe(1500);
  });

  it("流水失敗時帳戶、ledger、快照與排程推進全部回滾", async () => {
    await db.query(`
      create or replace function fail_recurring_transaction() returns trigger
      language plpgsql as $$
      begin
        if new.note like '%定期定額%' then
          raise exception 'forced transaction failure';
        end if;
        return new;
      end;
      $$;
      create trigger fail_recurring_transaction_trigger
      before insert on transactions
      for each row execute function fail_recurring_transaction();
    `);

    await expect(execute(db)).rejects.toThrow(/forced transaction failure/);

    expect(await count(db, "recurring_plan_runs")).toBe(0);
    expect(await count(db, "transactions")).toBe(0);
    expect(await count(db, "account_snapshots")).toBe(0);
    const account = await accountRow(db);
    expect(Number(account.quantity)).toBeCloseTo(10, 8);
    expect(Number(account.cost_basis_twd)).toBe(1000);
    const plan = (
      await db.query("select * from recurring_plans where id = $1", [PLAN_ID])
    ).rows[0];
    expect(plan.last_run_date).toBeNull();
    expect(toDate(plan.next_run_date)).toBe("2026-07-05");

    await db.query(`
      drop trigger fail_recurring_transaction_trigger on transactions;
      drop function fail_recurring_transaction();
    `);
  });

  it("cron 不可提前執行，manual 可立即執行並從執行月推進", async () => {
    await db.query(
      "update recurring_plans set next_run_date = '2026-07-20' where id = $1",
      [PLAN_ID],
    );

    await expect(execute(db, PLAN_ID, "2026-07-20", "cron")).rejects.toThrow(
      /尚未到執行日/,
    );
    expect(await count(db, "recurring_plan_runs")).toBe(0);

    const manual = (
      await execute(db, PLAN_ID, "2026-07-20", "manual")
    ).rows[0];
    expect(manual.executed).toBe(true);
    expect(toDate(manual.next_run_date)).toBe("2026-08-05");
  });
});

async function insertPlan(client: Client, id: string, amount: number) {
  await client.query(
    `insert into recurring_plans (
      id, user_id, account_id, amount_twd, day_of_month,
      start_date, next_run_date, active
    ) values ($1, $2, $3, $4, 5, '2026-07-01', '2026-07-05', true)`,
    [id, USER_ID, ACCOUNT_ID, amount],
  );
}

async function count(client: Client, table: string): Promise<number> {
  const result = await client.query(`select count(*)::int as count from ${table}`);
  return result.rows[0].count;
}

async function accountRow(client: Client) {
  return (
    await client.query("select * from accounts where id = $1", [ACCOUNT_ID])
  ).rows[0];
}

function toDate(value: string | Date): string {
  return value instanceof Date
    ? value.toISOString().slice(0, 10)
    : String(value).slice(0, 10);
}
