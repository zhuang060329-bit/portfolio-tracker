import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Client } from "pg";

const url = process.env.TEST_DATABASE_URL;
const ACCOUNT_ID = "11111111-1111-1111-1111-111111111111";
const MANUAL_ACCOUNT_ID = "33333333-3333-3333-3333-333333333333";
const OTHER_ACCOUNT_ID = "44444444-4444-4444-4444-444444444444";
const USER_ID = "22222222-2222-2222-2222-222222222222";
const OTHER_USER_ID = "55555555-5555-5555-5555-555555555555";

type IncomeRow = {
  account_id: string;
  type: "dividend" | "interest";
  amount: number;
  occurred_at: string;
  note: string | null;
};

describe.skipIf(!url)("import_income_transactions (integration)", () => {
  let db: Client;
  let db2: Client;

  beforeAll(async () => {
    db = new Client({ connectionString: url });
    db2 = new Client({ connectionString: url });
    await db.connect();
    await db2.connect();

    const root = join(__dirname, "..", "..");
    await db.query(readFileSync(join(root, "supabase/test-schema.sql"), "utf8"));
    await db.query(`
      do $roles$
      begin
        if not exists (select 1 from pg_roles where rolname = 'authenticated') then
          create role authenticated nologin;
        end if;
        if not exists (select 1 from pg_roles where rolname = 'anon') then
          create role anon nologin;
        end if;
      end
      $roles$;
    `);
    await db.query(readFileSync(join(root, "supabase/rpc-mutations.sql"), "utf8"));
    await db.query(`
      grant usage on schema auth to authenticated;
      grant select, update on public.accounts to authenticated;
      grant select, insert on public.transactions to authenticated;

      alter table public.accounts enable row level security;
      alter table public.transactions enable row level security;

      create policy income_import_accounts_select on public.accounts
        for select to authenticated
        using ((select auth.uid()) = user_id);
      create policy income_import_accounts_update on public.accounts
        for update to authenticated
        using ((select auth.uid()) = user_id)
        with check ((select auth.uid()) = user_id);
      create policy income_import_transactions_select on public.transactions
        for select to authenticated
        using ((select auth.uid()) = user_id);
      create policy income_import_transactions_insert on public.transactions
        for insert to authenticated
        with check ((select auth.uid()) = user_id);
    `);
  });

  afterAll(async () => {
    await db2?.end();
    await db?.end();
  });

  beforeEach(async () => {
    await db.query("truncate account_snapshots, transactions, accounts cascade");
    await db.query(
      `insert into accounts (
        id, user_id, name, asset_class, price_market, symbol, quantity,
        last_unit_price, last_fx_rate, manual_value_base, realized_pnl_twd
      ) values
        ($1, $4, 'ETF', 'fund', 'us', 'VOO', 10, 50, 2, null, 50),
        ($2, $4, '現金', 'liquid_cash', 'manual', null, 0, null, 1, 5000, 0),
        ($3, $5, '其他使用者', 'fund', 'us', 'SPY', 5, 100, 2, null, 0)`,
      [ACCOUNT_ID, MANUAL_ACCOUNT_ID, OTHER_ACCOUNT_ID, USER_ID, OTHER_USER_ID],
    );
  });

  it("整批建立流水並彙總更新各帳戶收益", async () => {
    const imported = await callAsUser(db, USER_ID, [
      row(ACCOUNT_ID, "dividend", 125.5, "VOO 配息"),
      row(ACCOUNT_ID, "interest", 24.5, null),
      row(MANUAL_ACCOUNT_ID, "interest", 80, "活存"),
    ]);

    expect(imported).toBe(3);
    const accounts = (
      await db.query(
        "select id, realized_pnl_twd from accounts order by id",
      )
    ).rows;
    expect(Number(accounts.find((item) => item.id === ACCOUNT_ID).realized_pnl_twd)).toBe(200);
    expect(Number(accounts.find((item) => item.id === MANUAL_ACCOUNT_ID).realized_pnl_twd)).toBe(80);

    const transactions = (
      await db.query(
        "select account_id, type, value_after_base, cashflow_twd, realized_pnl, note from transactions order by created_at, type",
      )
    ).rows;
    expect(transactions).toHaveLength(3);
    expect(
      transactions
        .filter((item) => item.account_id === ACCOUNT_ID)
        .every((item) => Number(item.value_after_base) === 1000),
    ).toBe(true);
    expect(
      Number(
        transactions.find((item) => item.account_id === MANUAL_ACCOUNT_ID)
          .value_after_base,
      ),
    ).toBe(5000);
    expect(
      transactions
        .map((item) => Number(item.cashflow_twd))
        .sort((left, right) => left - right),
    ).toEqual([24.5, 80, 125.5]);
    expect(transactions[0].note).toContain("TWD");
  });

  it("任一流水失敗時，整批流水與帳戶更新全部回滾", async () => {
    await db.query(`
      create or replace function fail_income_import() returns trigger
      language plpgsql as $$
      begin
        if new.note like '%強制失敗%' then
          raise exception 'forced income import failure';
        end if;
        return new;
      end;
      $$;
      create trigger fail_income_import_trigger
      before insert on transactions
      for each row execute function fail_income_import();
    `);

    try {
      await expect(
        callAsUser(db, USER_ID, [
          row(ACCOUNT_ID, "dividend", 100, null),
          row(MANUAL_ACCOUNT_ID, "interest", 200, "強制失敗"),
        ]),
      ).rejects.toThrow(/forced income import failure/);

      expect(await count(db, "transactions")).toBe(0);
      expect(await realizedPnl(db, ACCOUNT_ID)).toBe(50);
      expect(await realizedPnl(db, MANUAL_ACCOUNT_ID)).toBe(0);
    } finally {
      await db.query("drop trigger if exists fail_income_import_trigger on transactions");
      await db.query("drop function if exists fail_income_import()");
    }
  });

  it("同帳戶並行匯入保留兩批增量", async () => {
    const [first, second] = await Promise.all([
      callAsUser(db, USER_ID, [row(ACCOUNT_ID, "dividend", 100, null)]),
      callAsUser(db2, USER_ID, [row(ACCOUNT_ID, "interest", 200, null)]),
    ]);

    expect([first, second]).toEqual([1, 1]);
    expect(await count(db, "transactions")).toBe(2);
    expect(await realizedPnl(db, ACCOUNT_ID)).toBe(350);
  });

  it("RLS 拒絕其他使用者帳戶，且不留下部分流水", async () => {
    await expect(
      callAsUser(db, USER_ID, [
        row(ACCOUNT_ID, "dividend", 100, null),
        row(OTHER_ACCOUNT_ID, "dividend", 100, null),
      ]),
    ).rejects.toThrow(/不存在或無權限/);

    expect(await count(db, "transactions")).toBe(0);
    expect(await realizedPnl(db, ACCOUNT_ID)).toBe(50);
  });

  it("未登入角色不能直接執行匯入 RPC", async () => {
    await db.query("begin");
    try {
      await db.query("set local role anon");
      await expect(
        db.query("select import_income_transactions($1::jsonb)", [
          JSON.stringify([row(ACCOUNT_ID, "dividend", 100, null)]),
        ]),
      ).rejects.toThrow(/permission denied/i);
    } finally {
      await db.query("rollback");
    }
  });
});

function row(
  accountId: string,
  type: "dividend" | "interest",
  amount: number,
  note: string | null,
): IncomeRow {
  return {
    account_id: accountId,
    type,
    amount,
    occurred_at: "2026-07-10T02:00:00.000Z",
    note,
  };
}

async function callAsUser(
  client: Client,
  userId: string,
  rows: IncomeRow[],
): Promise<number> {
  await client.query("begin");
  try {
    await client.query("set local role authenticated");
    await client.query(
      "select set_config('request.jwt.claim.sub', $1, true)",
      [userId],
    );
    const result = await client.query(
      "select import_income_transactions($1::jsonb) as imported",
      [JSON.stringify(rows)],
    );
    await client.query("commit");
    return Number(result.rows[0].imported);
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

async function count(client: Client, table: string): Promise<number> {
  const result = await client.query(
    `select count(*)::int as count from ${table}`,
  );
  return result.rows[0].count;
}

async function realizedPnl(client: Client, accountId: string): Promise<number> {
  const result = await client.query(
    "select realized_pnl_twd from accounts where id = $1",
    [accountId],
  );
  return Number(result.rows[0].realized_pnl_twd);
}
