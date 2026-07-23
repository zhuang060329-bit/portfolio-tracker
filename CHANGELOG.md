# Changelog

本檔記錄 StackWorth 的重要變更。格式依循 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.1.0/)，版本遵循 [語意化版本](https://semver.org/lang/zh-TW/)。

日期為台北時間（Asia/Taipei）。

## [Unreleased]

### Added
- XIRR 求根新增二分法 fallback：Newton-Raphson 未通過殘差檢核時，改以二分法在 NPV 變號區間求根，結果仍須通過同一條殘差檢核，通不過一律回 `null`。減少「明明有解卻顯示 —」的情況，且不改動任何既有可解案例的數值。（`src/lib/xirr.ts`）
- `/methodology` 指標說明頁：公開靜態頁，說明 XIRR、TWR、Sharpe、最大回撤的計算口徑與「為何有時顯示 —」。
- `SECURITY.md`：安全性回報流程與支援版本說明。
- 本 `CHANGELOG.md`。

## [1.0.0] - 2026-07-18

首個標記版本。線上運作於 Vercel + Supabase（單一使用者）。

### 核心功能
- 多市場、多幣別投資組合追蹤：美股 ETF（Twelve Data）、台股（FinMind）、加密貨幣（CoinGecko）、手動資產，統一以 TWD 呈現。
- 單一計算管線 `buildDashboardData`（純函式）同時供正式頁與公開 `/demo` 使用；demo 資料為每日決定性生成，非 mockup。
- 報酬指標：XIRR 與 TWR 並列，採相反現金流慣例；XIRR solver 以殘差驗證把關。
- 風險指標：以現金流調整後的 TWR 指數計算最大回撤（提領不計為虧損）；Sharpe 將不規則快照區間換算等效單日報酬並以日曆日年化。
- 帳戶寫入路徑收斂至原子 Postgres RPC（`apply_account_mutation`）；定期定額以 ledger 為底、`(plan_id, scheduled_date)` 唯一鍵保證冪等（`execute_recurring_plan_mutation`）。
- 警示、通知中心、What-if 推演、CSV 匯入、全交易與年度稅務 CSV 匯出。

### 安全與驗證
- 每個 server action 輸入先過 Zod schema；其下為 Supabase RLS 與 TOTP MFA（AAL2）。
- CI 五道 gate：lint、typecheck、單元測試、真 Postgres 整合測試、production build。
- 日曆日換算明訂 `Asia/Taipei`，避免 Vercel UTC 造成快照日位移。

[Unreleased]: https://github.com/zhuang060329-bit/portfolio-tracker/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/zhuang060329-bit/portfolio-tracker/releases/tag/v1.0.0
