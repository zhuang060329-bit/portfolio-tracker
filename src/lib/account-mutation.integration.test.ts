import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Client } from "pg";

// apply_account_mutation 的整合測試：打真 Postgres，驗的是 SQL 本身。
// - 本地：TEST_DATABASE_URL=postgresql://... npx vitest run
// - CI：workflow 起 postgres service 並注入同名環境變數
// - 未設環境變數時整組跳過（單元測試不受影響）
// beforeAll 直接套 supabase/test-schema.sql + rpc-mutations.sql，
// 測試檔即為 migration 的可執行規格。

const url = process.env.TEST_DATABASE_URL;

const ACC = "11111111-1111-1111-1111-111111111111";
const USER = "22222222-2222-2222-2222-222222222222";

describe.skipIf(!url)("apply_account_mutation (integration)", () => {
  let db: Client;

  beforeAll(async () => {
    db = new Client({ connectionString: url });
    await db.connect();
    const root = join(__dirname, "..", "..");
    await db.query(readFileSync(join(root, "supabase/test-schema.sql"), "utf8"));
    await db.query(readFileSync(join(root, "supabase/rpc-mutations.sql"), "utf8"));
  });

  afterAll(async () => {
    await db?.end();
  });

  beforeEach(async () => {
    await db.query("truncate account_snapshots, transactions, accounts cascade");
    await db.query(
      `insert into accounts (id, user_id, name, asset_class, price_market, symbol, quantity, cost_basis_twd)
       values ($1, $2, '測試帳戶', 'fund', 'us', 'VOO', 10, 100000)`,
      [ACC, USER],
    );
  });

  const call = (patch: object, tx: object | null, snaps: object[]) =>
    db.query("select apply_account_mutation($1, $2, $3, $4)", [
      ACC,
      JSON.stringify(patch),
      tx === null ? null : JSON.stringify(tx),
      JSON.stringify(snaps),
    ]);

  it("正常路徑：patch 部分更新 + 流水 + 兩筆快照，user_id 由帳戶擁有者補", async () => {
    await call(
      { quantity: 12, cost_basis_twd: 120000, last_unit_price: 520 },
      {
        type: "adjust_quantity",
        quantity_after: 12,
        unit_price: 520,
        fx_rate: 32,
        value_after_base: 199680,
        note: "加碼 20000 TWD",
        cashflow_twd: -20000,
      },
      [
        { snapshot_date: "2026-07-05", quantity: 12, unit_price: 520, fx_rate: 32, value_base: 199680 },
        { snapshot_date: "2026-07-06", quantity: 12, unit_price: 521, fx_rate: 32, value_base: 200064 },
      ],
    );
    const acc = (await db.query("select * from accounts where id = $1", [ACC])).rows[0];
    expect(Number(acc.quantity)).toBe(12);
    expect(Number(acc.cost_basis_twd)).toBe(120000);
    expect(acc.symbol).toBe("VOO"); // patch 沒帶的欄位不動
    const tx = (await db.query("select * from transactions")).rows;
    expect(tx).toHaveLength(1);
    expect(tx[0].user_id).toBe(USER);
    expect(Number(tx[0].cashflow_twd)).toBe(-20000);
    const snaps = (await db.query("select * from account_snapshots order by snapshot_date")).rows;
    expect(snaps).toHaveLength(2);
    expect(snaps.every((s) => s.user_id === USER)).toBe(true);
  });

  it("同日快照重寫：upsert 覆蓋，不產生重複列", async () => {
    await call({}, null, [
      { snapshot_date: "2026-07-06", quantity: 10, unit_price: 520, fx_rate: 32, value_base: 166400 },
    ]);
    await call({}, null, [
      { snapshot_date: "2026-07-06", quantity: 10, unit_price: 525, fx_rate: 32, value_base: 168000 },
    ]);
    const rows = (
      await db.query("select value_base from account_snapshots where snapshot_date = '2026-07-06'")
    ).rows;
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].value_base)).toBe(168000);
  });

  it("原子性：流水寫入失敗 → 帳戶 patch 一併回滾", async () => {
    await expect(
      call({ quantity: 999 }, { type: "bogus_type" }, []),
    ).rejects.toThrow(/txn_type/);
    const acc = (await db.query("select quantity from accounts where id = $1", [ACC])).rows[0];
    expect(Number(acc.quantity)).toBe(10); // 不是 999
  });

  it("sell 語意完整：realized_pnl 與 created_at 寫進流水", async () => {
    await call(
      { quantity: 8, realized_pnl_twd: 1200 },
      {
        type: "sell",
        quantity_after: 8,
        cashflow_twd: 30000,
        realized_pnl: 1200,
        created_at: "2026-07-01T10:00:00+08:00",
        note: "賣出 2 股",
      },
      [],
    );
    const tx = (await db.query("select * from transactions where type = 'sell'")).rows[0];
    expect(Number(tx.realized_pnl)).toBe(1200);
    expect(new Date(tx.created_at).toISOString()).toBe("2026-07-01T02:00:00.000Z");
  });

  it("不存在的帳戶：raise，不寫任何東西", async () => {
    await expect(
      db.query("select apply_account_mutation($1, '{}', null, '[]')", [
        "99999999-9999-9999-9999-999999999999",
      ]),
    ).rejects.toThrow(/不存在或無權限/);
    expect((await db.query("select count(*)::int as n from transactions")).rows[0].n).toBe(0);
  });
});
