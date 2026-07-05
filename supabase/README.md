# Supabase SQL 執行順序

從零部署一個全新的 Supabase 專案時，到 SQL Editor 依下面順序逐個跑：

| # | 檔案 | 內容 | 必跑？ |
|---|---|---|---|
| 1 | `schema.sql` | 4 張表（profiles / accounts / transactions / account_snapshots） + RLS policy + 新使用者 trigger | ✅ |
| 2 | `recurring-plans.sql` | `recurring_plans` 表（定期定額計劃） | ✅ |
| 3 | `cost-basis.sql` | `accounts.cost_basis_twd` 欄位 + 回填 | ✅ |
| 4 | `realized-pnl-cashflow.sql` | enum 加 sell/dividend/interest + `accounts.realized_pnl_twd` + `transactions.{realized_pnl, cashflow_twd}` | ✅ |
| 5 | `batch2-schema.sql` | `accounts.{status, cost_basis_native}` + `profiles.allocation_targets` | ✅ |
| 6 | `open-signup.sql` | 移除舊版的 email allowlist trigger（如果跑過 email-allowlist.sql 的話）。改為開放註冊，admin 從 /admin/allowlist 頁面看誰註冊、踢人 | ⭐ 推薦 |
| 7 | `alerts.sql` | `alerts` + `notifications` 兩張表 + RLS（價格警示、配置失衡提醒） | ✅ |

## 注意事項

- **`alter type ... add value`** 加 enum 值跟後面的 `update` 不能在同一個 transaction。如果 SQL Editor 跑檔案 4 卡 "unsafe use of new value of enum type"，把 `alter type` 那三行單獨跑一次，再跑剩下。
- 跑完任何 schema 變更（加欄位 / 改 enum）建議手動：
  ```sql
  notify pgrst, 'reload schema';
  ```
  讓 PostgREST 立刻看到新欄位（部分檔案已自帶這行）。
- 所有 RLS policy 都綁 `auth.uid()`，使用者只能存取自己的資料；service-role key（給 cron 用）會繞過 RLS。

## 使用者管理

開放註冊後，admin 從 app 內的 `/admin/allowlist` 看誰註冊了、踢出特定人。
不需要再手動跑 SQL 加 email。

admin 認定：env var `ADMIN_EMAILS`（逗號分隔）。未設則無任何 admin。
