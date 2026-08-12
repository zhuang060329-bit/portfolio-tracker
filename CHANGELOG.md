# Changelog

本檔記錄 StackWorth 的重要變更。格式依循 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.1.0/)，版本遵循 [語意化版本](https://semver.org/lang/zh-TW/)。

日期為台北時間（Asia/Taipei）。

## [Unreleased]

（尚無）

## [1.1.0] - 2026-08-12

以可用性、無障礙與安全性為主的一輪。沒有破壞性變更，既有資料與計算口徑不變。

### Added
- 交易手續費（費用內含）：買賣可記錄手續費，計入成本基礎與已實現損益。
- 撤銷最新一筆交易 / 沖銷較早的交易：最新一筆可直接撤銷，較早的以反向沖銷處理，保留稽核軌跡。
- 使用者可自行刪除帳戶。
- 定期定額可覆寫單次執行金額（不影響後續期數）。
- `/whatif` 再平衡分頁：把配置偏離的百分點換算成「該補多少錢」。
- CSV 匯入支援買賣與完整往返：匯出的檔案可以原樣匯回。匯出新增
  `Account cost basis (TWD)` 與 `(native)` 兩欄，兩邊共用同一份表頭常數避免漂移。
  沒有成本基礎欄位的舊檔會拒收持倉列、只匯入收益列；以 `型別|時間` 指紋擋重複匯入。
- 免費報價 API 全域每日預算：Twelve Data / FinMind / CoinGecko 各自設上限，
  避免免費額度被單日耗盡。需設 `API_BUDGET_*` 環境變數（未設時採保守預設值）。
- Holdings 排序過渡（FLIP）：按排序鍵時列滑到新位置。以 Web Animations API 手寫，
  零新依賴；只由排序觸發，背景刷新報價造成的重排不會動畫。
- XIRR 求根新增二分法 fallback：Newton-Raphson 未通過殘差檢核時，改以二分法在 NPV 變號區間求根，結果仍須通過同一條殘差檢核，通不過一律回 `null`。減少「明明有解卻顯示 —」的情況，且不改動任何既有可解案例的數值。（`src/lib/xirr.ts`）
- `/methodology` 指標說明頁：公開靜態頁，說明 XIRR、TWR、Sharpe、最大回撤的計算口徑與「為何有時顯示 —」。
- `SECURITY.md`：安全性回報流程與支援版本說明。
- 本 `CHANGELOG.md`。
- `/demo` 專屬載入骨架（`src/app/demo/loading.tsx`）：改用 `DemoV1Header`，避免公開訪客載入瞬間閃到已登入版導覽。

### Security
- **Content-Security-Policy（目前為 Report-Only）**：每個 request 產生 nonce，
  由 `src/proxy.ts` 發出。`object-src 'none'`、`base-uri 'self'`、`frame-ancestors 'none'`、
  `form-action 'self'`，`connect-src` 只放行自身與 Supabase（有設 Sentry 才加）。
  刻意不加 `'strict-dynamic'`——實測會讓 `'self'` 被忽略而打壞 `/demo` 三頁的
  parser-inserted chunk。`style-src` 保留 `'unsafe-inline'` 且不帶 nonce，
  因為全站有動態 `style` 屬性，而同指令帶 nonce 會使 `'unsafe-inline'` 失效。
  **尚未強制執行**：`src/lib/csp.ts` 的 `CSP_ENFORCE` 仍為 `false`，翻成 `true` 前
  需先開站確認 console 無違規。副作用：使用 nonce 後全站改為動態渲染，
  原本 7 個靜態頁不再被 CDN 快取。
- 刷新報價的查詢錯誤不再把 PostgREST 原文丟給前端，改回固定訊息並只在伺服器端記 code。
- Next.js 升至 16.2.11：涵蓋 App Router Proxy bypass（Turbopack 單語系）、Server Actions SSRF/DoS、cache confusion、Image Optimization SVG DoS、未授權 Server Function 端點揭露等一系列 advisory。
- `npm audit fix`（非破壞性）清除 brace-expansion、fast-uri、js-yaml、vite 等建置/測試鏈的傳遞漏洞。剩餘 2 項為 Next 自帶 bundled sharp（<0.35）之 libvips CVE，唯一「修法」是把 Next 降級至 14.2.35 並重新引入上述 Proxy bypass，故不採用；本專案不對不受信任影像做 Image Optimization，殘餘風險低。

### Fixed
- 切頁時右上角會閃出「登入」，以及新增帳戶的三個子頁一直顯示「登入」。
- 刷新報價後淨資產會先掉到 0 再爬回來：count-up 改為從目前顯示值過渡，時長 1100ms → 450ms。
- 首頁總淨資產數字頂端被裁掉：`truncate` 帶的 `overflow:hidden` 配上 `leading-[0.92]`，
  行框比字框矮，上緣溢出約 2.65px。改用 `whitespace-nowrap`，垂直排版未動。
- `min-h-screen` 全數改為 `min-h-dvh`（38 處）：iOS Safari 以收合前的視窗高度計算 `100vh`，
  短頁面會出現幽靈捲動。
- 淺色模式漲跌色未達 WCAG AA；資產類別色票改走 CSS 變數並補上淺色組；
  快速記帳的無市價警示在淺色模式看不見。
- 定期定額：金額框殘留、重複文案、窄螢幕排版；本期金額 min 改為 `0.01`。
- `/methodology` 加入 Proxy 公開白名單：先前只放行 `/login`、`/auth`、`/demo`，公開 Demo 訪客點「指標怎麼算」會被導向登入頁。

### Changed
- **無障礙**：
  - 加上「跳至主內容」連結（WCAG 2.4.1 Level A）。
  - 建立全域 `:focus-visible` 基準，補回三處被移除的焦點指示。
  - 首頁 `h1` 改為語意標題（`sr-only` 的「投資組合總覽」），金額降級成 `div`——
    原本標題內容是會變動的數字，頁面等於沒有穩定的名字。
  - 動作結果改由常駐 live region 播報。
  - 觸控目標放大到 44px（WCAG 2.5.5 AAA）：主圖表區間鈕、刪除提醒鈕、定期定額區塊；
    刪除提醒鈕的 emoji 一併換成 inline SVG。
  - `prefers-reduced-motion` 改為只關位移與縮放，保留淡入與顏色回饋，
    取代原本把所有動畫壓成 0.01ms 的粗暴寫法。
  - `--c-faint` 文字色提高對比至 WCAG AA：亮色 2.6:1 → 4.70:1、暗色 3.66:1 → 5.58:1，仍低於各自 `--c-muted` 以保留層級。
- **效能**：三支字體改自架，移除建置期對 Google Fonts 的相依；
  recharts 改 `next/dynamic`，移出帳戶詳情頁的初始載入。
- 加上 MIT 授權。

### Removed
- 未被任何檔案引用的 `src/components/AllocationTargets.tsx`（設定頁的目標配置由 `SettingsApp` 直接接 `setAllocationTargets` action）。
- Windows 專用的 dev server 啟動器（`start-dev.bat`、`start-dev-min.vbs`），開發已全面移到 macOS。

### Migration
本版新增四個 migration，套用順序即檔名順序：

- `20260810155500_recurring_amount_override.sql`（定期定額單次金額覆寫）
- `20260810230000_transaction_fee.sql`（交易手續費）
- `20260810234500_transaction_reversal.sql`（撤銷 / 沖銷）
- `20260811120000_api_budget.sql`（報價 API 每日預算）

請先在測試資料庫執行。

## [1.0.0] - 2026-07-18

首個標記版本。線上運作於 Vercel + Supabase（單一使用者）。

### 核心功能
- 多市場、多幣別投資組合追蹤：美股 ETF（Twelve Data）、台股（FinMind）、加密貨幣（CoinGecko）、手動資產，統一以 TWD 呈現。
- 單一計算管線 `buildDashboardData`（純函式）同時供正式頁與公開 `/demo` 使用；demo 資料為每日決定性生成，非 mockup。
- 報酬指標：XIRR 與 TWR 並列，採相反現金流慣例；XIRR solver 以殘差驗證把關。
- 風險指標：以現金流調整後的 TWR 指數計算最大回撤（提領不計為虧損）；Sharpe 將不規則快照區間換算等效單日報酬並以日曆日年化。
- 帳戶寫入路徑收斂至原子 Postgres RPC（`apply_account_mutation`）；定期定額以 ledger 為底、`(plan_id, scheduled_date)` 唯一鍵保證冪等（`execute_recurring_plan_mutation`）。
- 投資決策日誌、as-of 歷史重播與報酬歸因、可疊加 shock 的 What-if 壓力測試、可選月份投資報告與 print-to-PDF。
- 警示、通知中心、CSV 匯入、全交易與年度稅務 CSV 匯出。

### 安全與驗證
- 每個 server action 輸入先過 Zod schema；其下為 Supabase RLS 與 TOTP MFA（AAL2）。
- CI 五道 gate：lint、typecheck、單元測試、真 Postgres 整合測試、production build。
- 日曆日換算明訂 `Asia/Taipei`，避免 Vercel UTC 造成快照日位移。

### Migration
- 需先套用 `supabase/migrations/20260718032234_stackworth_v1.sql` 才能使用新的需登入頁面（決策日誌、歷史重播、月報）。請先在測試資料庫執行；本版本沒有直接修改 production。

[Unreleased]: https://github.com/zhuang060329-bit/portfolio-tracker/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/zhuang060329-bit/portfolio-tracker/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/zhuang060329-bit/portfolio-tracker/releases/tag/v1.0.0
