import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Client } from "pg";

/**
 * 整合測試的資料庫起手式：先把 schema 清成空白，再依序套用 SQL 檔。
 *
 * 為什麼要清 schema，而不是像原本那樣直接套：
 * 三支 `*.integration.test.ts` 共用同一個 Postgres（CI 是一個 service 容器，
 * 本機是一條 TEST_DATABASE_URL），`fileParallelism: false` 讓它們依序跑，
 * 但**跑完不會還原**。而 migration 裡改函式簽名的寫法是
 * `drop function <舊簽名>` + `create function <新簽名>`：
 *
 *   1. account-mutation 先跑 → 庫裡留下 7 參數與 9 參數兩個
 *      `execute_recurring_plan_mutation`（它不套 recurring_amount_override，
 *      所以 8 參數那版從未出現，transaction_fee 的 drop 落空但無害）。
 *   2. recurring-plan 接著跑 → 套 recurring_amount_override 建出 8 參數，
 *      再套 transaction_fee：drop 掉 8 參數、create 9 參數 —— 而 9 參數
 *      在第 1 步就存在了 → `42723 already exists with same argument types`。
 *
 * 各檔 `beforeEach` 的 truncate 只清資料表，清不掉函式，所以擋不住這件事。
 * 清 schema 之後每支測試看到的都是「自己第一個跑」的狀態，順序不再有意義。
 *
 * auth 一起清是因為 test-schema.sql 用 `create schema if not exists auth`，
 * 留著會讓 auth.users 帶著上一支的資料進來。
 * anon / authenticated / service_role 是叢集層級的角色、不隨 schema 消失，
 * test-schema.sql 本來就用 `exception when duplicate_object` 處理重複建立。
 */
export async function resetAndApply(
  db: Client,
  root: string,
  files: string[],
): Promise<void> {
  await db.query("drop schema if exists public cascade");
  await db.query("drop schema if exists auth cascade");
  await db.query("create schema public");
  for (const file of files) {
    await db.query(readFileSync(join(root, file), "utf8"));
  }
}
