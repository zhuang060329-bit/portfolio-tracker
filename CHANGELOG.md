# Changelog

本檔記錄 StackWorth 的重要變更。格式依循 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.1.0/)，版本遵循 [語意化版本](https://semver.org/lang/zh-TW/)。

日期為台北時間（Asia/Taipei）。

## [Unreleased]

（尚無）

## [1.2.0] - 2026-08-18

首頁總覽的視覺層級與互動整輪重做。只動呈現，資料模型、計算口徑、
路由與後端行為皆未變動；`xirr` / `metrics` / `whatif` 一行未改，測試數值不變。
字體替換會連帶影響全站的拉丁字，其餘改動的作用域都在首頁。

### Changed
- **拉丁字體 Space Grotesk → IBM Plex Sans**，數字另配 IBM Plex Mono（400/500/600
  三個靜態字重，上游無變數檔），襯線 Newsreader 保留。等寬只作用在首頁（`.ledger`
  作用域），其他頁的數字仍是 Plex Sans。字體變數命名為 `--font-figures` 而非
  `--font-mono`，避開 Tailwind `font-mono` utility 讀的同名變數——全站三處
  `font-mono`（error 頁、MFA 密鑰、`/methodology` 行內 code）用的字集含符號，
  改到只收數字的子集會掉字。拉丁字體總量 25.8 → 72.8 KB（Noto Sans TC 仍是 1,683 KB）。
- **字級收成 8 級尺標**（`--fs-axis` 10 至 `--fs-display` clamp(40,7vw,64)），
  取代首頁原本 15 個散落的 px 值。定義成自訂變數而非 Tailwind `@theme`，
  後者會改動全站 316 處 `text-*` utility。
- **首頁改成三級視覺層級**：一級摘要（Hero + 四格）落在頁面底色、二級核心資料
  （持倉帳本＋資產配置、淨資產趨勢）保留卡片容器、三級輔助（績效指標）靠 hairline 分區。
  改版前五個區塊同一套 rounded+border+surface，權重一致，沒有進入點。
- **資產配置從三級搬到二級，與持倉帳本並排**（≥1180px；再窄則上下堆疊）。
  斷點取決於表格自身的 760px 最小寬與配置欄的 344px。改版前兩者相距 515px，
  視窗要高於約 1360px 才可能同時看到。
- **幣別標示規則統一**：同單位群組的最上層宣告一次。一級摘要由 Hero 宣告，
  四格不再各自冠 NT$；持倉表格改在表頭標一次（改版前整張表沒有任何幣別標示，
  而美股列的市值是換算後的台幣）。手機持倉卡片沒有表頭，維持逐列標示。
- **「選中」語彙收斂成兩套**：互斥選擇（模式切換、區間、排序）統一為 accent 文字 +
  字重 + 淡填色；獨立開關（圖例）只用邊框與透明度、不填色。填色不再用 accent-soft
  ——accent 文字疊在其上實測深色 4.42:1、淺色 4.37:1，兩個主題各有一種底色低於
  AA 的 4.5:1；改疊 surface-soft 為 4.87 / 5.11。
- **排序在桌機與手機講同一套**：手機藥丸原本寫「名稱」「損益」、桌機表頭寫「帳戶」
  「未實現」，改成逐字相同；藥丸列補可見的「排序」標籤與 `role="group"`。
- **首頁五個區塊改為依序進場**（40ms 一階、單個 0.28s，440ms 結束），取代原本整頁
  一次淡入。`prefers-reduced-motion` 下沿用既有的逐項處理，位移拿掉、淡入保留。
- **手機持倉卡密度**：133 → 106px（桌機同一筆 71px），欄位一個沒少，收的是間距。

### Added
- **圖表刻度改用 nice number**（`chart-scale.ts`，純函式 + 28 條測試）：刻度落在
  1/2/5 × 10ⁿ 的倍數，取代原本把資料範圍五等分（會產生 92.3萬 / 100.4萬 這種刻度）。
  X 軸日期標籤數量改由可用寬度決定，不再固定頭／中／尾三個。
- **格線色 `--c-grid`**：原本用 `--c-border`，對卡片底色只有 1.25:1，實測等同看不見，
  Y 軸標籤浮在空中。壓到約 1.6:1。
- **列 hover 色 `--c-row-hover`**：原本沿用 `--c-surface-soft`，對底色只有 1.073:1。
  拉到約 1.245:1。
- **資產類別選取連動持倉列**：滑過或釘住某一類，對應的持倉列以內嵌 accent 直條標記
  （不採「其他列變淡」，那會讓要讀的數字不能讀）。
- **手機捲過 Hero 後浮出精簡摘要**：顯示總額與今日變化。整頁在 390×844 下有 3.6 屏，
  而總淨資產在 y 174 就離開視野。桌機不做。

### Fixed
- 資產配置的類別列 hover 與 click 共用同一個 state，`onMouseLeave` 無條件清空，
  導致滑鼠使用者永遠釘不住任何一類，而 `aria-pressed` 宣告了一個不存在的持久狀態。
  拆成 pinned 與 hovered，`aria-pressed` 只反映前者。
- 圓環中心數字在千萬級會壓到圓環上：孔徑 96px，而 26px 下四位數萬的字串量到 104px。
  字級降一級後上限 88px。
- 持倉表格欄寬與資訊量相反：「配置」拿到 243px（全表最寬）卻只裝得下 93px 內容，
  會被截斷的「帳戶」只有 218px。改用 colgroup 明寫。
- 持倉表格的配置長條原本軌道固定 48px，最大部位 39.4%，實測填色 2.8–18.9px，
  最小的一格是個 2.8px 的點。軌道改成撐滿欄寬後為 7–47.7px。
- `/methodology` 連結「指標怎麼算」高度只有 17px，低於 WCAG 2.5.8（AA）的 24×24。
- **沖銷帶手續費的交易會失敗**。`20260810230000_transaction_fee.sql` 給 `fee_twd` 加的是
  `check (fee_twd is null or fee_twd >= 0)`，而 45 分鐘後的
  `20260810234500_transaction_reversal.sql` 沖銷時寫的是 `-v_txn.fee_twd`，兩者矛盾。
  結果是「沖銷較早的一筆」只要原始交易記過手續費就整筆 rollback。這在 v1.1.0
  上線當天就存在。放寬約束成 `fee_twd is null or fee_twd >= 0 or reversal_of is not null`：
  沖銷列是 contra entry，`cashflow_twd` 與 `realized_pnl` 早就是負的，手續費跟著變號才一致。

### Internal
- **CI 的 Gate 4（Postgres 整合測試）修好**。自 2026-08-12（v1.1.0 發版當天）起每一次都紅，
  錯誤是 `42723 function "execute_recurring_plan_mutation" already exists with same argument
  types`：三支整合測試共用同一個 Postgres 卻不清 schema，而 migration 改函式簽名用的是
  `drop <舊簽名>` + `create <新簽名>`，前一支留下的新簽名不在後一支的 drop 清單裡。
  各檔 `beforeEach` 的 `truncate` 只清資料表、清不掉函式。改成套 SQL 前先
  `drop schema public / auth cascade` 再重建。修好之後才浮出上面那條沖銷手續費的 bug——
  那條測試案例一直都在，只是從來沒真正跑過。

### Migration
- **必跑**：`supabase/migrations/20260818130000_reversal_negative_fee.sql`。
  不跑的話「沖銷較早的一筆」對記過手續費的交易仍然會失敗。
  既有部署若已完成 1–13，只需執行這一支。執行順序見 `supabase/README.md`。

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

[Unreleased]: https://github.com/zhuang060329-bit/portfolio-tracker/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/zhuang060329-bit/portfolio-tracker/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/zhuang060329-bit/portfolio-tracker/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/zhuang060329-bit/portfolio-tracker/releases/tag/v1.0.0
