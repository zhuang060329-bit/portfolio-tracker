# Supabase 規則

## 環境限制

- 只允許操作 dev / staging 環境
- 禁止在 production 執行任何 schema 變更、資料刪除或 RLS 修改
- 任何 production 操作須使用者明確指示並確認後才能進行

## RLS（Row Level Security）

- 所有新建資料表必須啟用 RLS
- 禁止 `ALTER TABLE ... DISABLE ROW LEVEL SECURITY`
- 新增 policy 前先確認覆蓋範圍（SELECT / INSERT / UPDATE / DELETE 分開考量）

## Migration 格式

- 每次 schema 變更寫成獨立 `.sql` delta 檔，不直接改 `schema.sql` 主檔
- 命名含日期與描述，例：`supabase/2026-06-12-add-alerts-table.sql`
- 執行順序見 `supabase/README.md`

## SQL 安全

- 禁止字串拼接 SQL，使用參數化查詢
- `service_role` key 只在 server action / cron 使用，禁止流向 client
- 禁止把 API key、連線字串寫進 code 或推進 repo

## Secret 存放

- 本機：`.env.local`（已被 `.gitignore` 排除）
- 部署：Vercel 環境變數面板
- 禁止以任何形式在 code、commit message、log 中出現 key 值
