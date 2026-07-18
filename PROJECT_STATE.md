# PROJECT_STATE

> 產出日期：2026-07-18
> 資料來源：本 checkout 的程式碼、migration、測試、build、瀏覽器 smoke 與 git 狀態；舊文件沒有直接當成現況。

## Repository

- Local checkout：`D:\Codex\portfolio-tracker`
- Remote：`https://github.com/zhuang060329-bit/portfolio-tracker.git`
- Branch：`feat/stackworth-v1`
- Base：`origin/main` at `98f808fdee48564ed1ee678c8ce157227888f1fa`
- Package version：`1.0.0`
- 目前 v1 程式尚未 merge、tag、release 或部署；production 資料庫沒有被本次工作修改。

## v1 範圍

- 決策日誌：建立、交易連結、編輯、封存、不可改寫的建立時情境、到期狀態與結構化檢討。
- 歷史重播與報酬歸因：as-of 帳戶生命週期、snapshot 來源日期、價格／匯率／收入／現金流拆分、reconciliation 與 residual 警告。
- 情境模擬與買前檢核：同時價格／匯率 shock、範本、持倉明細、外部試買、集中度與配置偏離；全程只讀。
- 月度報告：可選月份、報酬與歸因、配置、收入、決策、資料健康、免責聲明、金額遮罩狀態與瀏覽器列印。
- 公開 Demo：`/demo/decisions`、`/demo/history`、`/demo/whatif`、`/demo/report`，只使用 deterministic fixtures。

## 資料庫

- Versioned migration：`supabase/migrations/20260718032234_stackworth_v1.sql`
- 新表：`account_status_history`、`investment_decisions`、`decision_reviews`
- 新欄位：集中度設定、snapshot 成本／狀態欄位
- 新 trigger／RPC：帳戶狀態歷史、snapshot 補值、決策 context 不可改寫、原子檢討寫入，以及含狀態歷史的 `apply_account_mutation`
- 新表有 ownership、foreign key、index、constraint、grant 與逐操作 RLS。
- Migration 尚未套用任何正式資料庫。既有部署必須先在獨立測試資料庫驗證，再由使用者核准 production 套用。

## 2026-07-18 驗證

| Gate | 結果 |
|---|---|
| `npm.cmd run lint` | 通過 |
| `npm.cmd run typecheck` | 通過 |
| `npm.cmd run test:unit` | 22 files、145 tests 通過 |
| `npm.cmd run test:integration` | 2 files、16 tests 跳過；本機沒有 `TEST_DATABASE_URL`，Docker daemon 也未運作 |
| `npm.cmd run build` | 通過；Next.js 16.2.10，29 個 static page generation jobs；需網路取得既有 Google Fonts |
| `scripts/browser-smoke.ps1` | 通過；5 個公開 Demo 路由與 375px／360px viewport 斷言 |

整合測試尚未在真實 Postgres 執行，不得描述成通過。CI 設定仍保留 lint、typecheck、unit、Postgres integration 與 build；本機沒有聲稱遠端 CI 結果。

## 已知限制

- replay／月報的 snapshot 查詢上限為 10,000 筆；達上限會顯示截斷警告。v1 沒有事件溯源系統。
- 決策檢討的價格、FX、最大有利／不利變動取決於已保存的 daily snapshots；資料不足時顯示缺口或 `—`。
- 報告輸出採瀏覽器列印／儲存 PDF，未加入 server-side Chromium。
- 需登入的建立決策、交易連結與完成檢討流程尚未在本機瀏覽器連真實 Supabase 執行；`docs/V1_BROWSER_SMOKE.md` 列出獨立測試環境清單。
- `gh` CLI 尚未安裝，因此本機尚未 push 功能分支或建立 PR。

## 下一步

1. 安裝並登入 GitHub CLI；push `feat/stackworth-v1`，建立 draft PR，不合併。
2. 在獨立 Postgres 設定 `TEST_DATABASE_URL`，執行 16 個 integration tests。
3. PR 與 CI 通過後，在測試 Supabase 套用 v1 migration 並驗收登入流程。
4. 只有取得使用者 production 核准後，才套用 migration、merge 或部署；不要建立 tag 或 release。
