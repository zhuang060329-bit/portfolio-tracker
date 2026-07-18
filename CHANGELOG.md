# Changelog

## 1.0.0 - 2026-07-18

### 主要功能

- 新增投資決策日誌、交易連結、建立時情境快照、編輯、封存、到期檢討與原子 review 儲存。
- 新增 as-of 歷史重播、帳戶 active/archive 歷史與缺失價格來源標示。
- 新增期間報酬歸因，分離 contribution、withdrawal、價格、FX、收入、scope change 與 residual。
- 擴充既有 What-if，加入可疊加的 deterministic price/FX shocks、情境範本與只讀試買檢核。
- 新增可選月份的投資報告與 print-to-PDF 樣式。
- 新增四個 deterministic 公開 Demo 流程與可重複的 `scripts/browser-smoke.ps1`。

### Migration

- 新增 `supabase/migrations/20260718032234_stackworth_v1.sql`。
- 建立 `account_status_history`、`investment_decisions`、`decision_reviews`，並加入 foreign keys、checks、indexes、grants 與逐操作 RLS。
- 擴充 profile 集中度設定及 account snapshot 的成本／狀態欄位。
- 新增情境快照不可改寫 trigger、帳戶狀態與 snapshot trigger、`save_decision_review` RPC，並更新 `apply_account_mutation`。

### 相容性與部署條件

- 沒有移除既有頁面、公開 API route 或環境變數。
- 既有資料庫必須先套用 v1 migration，才可使用新的需登入頁面。請先在測試資料庫執行；本版本沒有直接修改 production。
- 沒有新增 npm runtime dependency；月報 PDF 使用瀏覽器列印。

### 已知限制

- replay 與報告使用最多 10,000 筆相關 snapshot；截斷會在 UI 顯示。
- 歷史價格或 FX snapshot 不足時，拆分與 review 指標會是 null／缺口，系統不使用今天價格補歷史。
- 自動 review 指標不評斷決策好壞；結果、過程和遵守計畫由使用者分開紀錄。
- 本機沒有 `TEST_DATABASE_URL`，因此本機的 16 個 Postgres integration tests 是 skipped；PR CI 已在 PostgreSQL 16 實際執行並通過 16/16。
- 已登入瀏覽器寫入流程仍需在獨立 Supabase 測試環境驗收。

### 驗證結果

- lint：通過。
- typecheck：通過。
- unit：22 files、145 tests 通過。
- integration：本機 2 files、16 tests skipped；GitHub Actions PostgreSQL 16 為 2 files、16 tests 通過。
- production build：通過；sandbox 外取得專案既有 Google Fonts。
- browser smoke：五個公開 Demo route、歷史日期切換、情境＋試買、月份切換、金額遮罩、深色模式與三個 viewport 已驗收；自動 script exit code 0。
