# StackWorth GitHub 生態競品研究與工程標竿分析

- 撰寫日期 / 資料蒐集日期：2026-07-22
- 撰寫方式：Claude Code 於本地讀取 StackWorth 原始碼 + GitHub CLI / API 逐一查證候選專案
- 範圍：只做研究、比較與規劃；未修改任何產品程式碼、未建立 commit、未 push

---

## 1. 執行摘要

- GitHub 上確實存在完成度與成熟度明顯高於 StackWorth 的同類專案，最主要的三個是 **Ghostfolio**（TypeScript 全端 wealth management）、**Portfolio Performance**（14 年歷史的 Java 桌面績效計算工具）、**Wealthfolio**（Rust + Tauri local-first 追蹤器）。
- StackWorth 在「單人使用範圍內的金融計算正確性」上並不落後——XIRR 殘差驗證、TWR 現金流隔離、cashflow-adjusted drawdown 這些細節，多數同類開源專案沒有做到這個程度。
- 真正的差距在三個層面：**(a) 市場資料基礎設施**（成熟專案把歷史價格與匯率存成第一級資料表，StackWorth 依賴 last_fx_rate 單值，已知有 cost basis 累積誤差）；**(b) 匯入管線**（成熟專案有券商格式 preset、匯入預覽、dry-run）；**(c) 工程營運紀律**（release tag、changelog、E2E 煙霧測試，StackWorth 目前 0 tags、0 releases）。
- 建議的最高 ROI 五項改動見第 14、19 節；其中匯率歷史 snapshot 屬正確性問題，列 P0。

## 2. StackWorth 現況摘要

### 2.1 產品定位（已由文件 + 程式碼驗證）

單一使用者的多市場、多幣別投資組合追蹤器：美股 ETF（Twelve Data）、台股（FinMind）、加密貨幣（CoinGecko）、手動資產，統一以 TWD 呈現。已部署於 Vercel + Supabase，生產環境單人使用中，另有無需登入的 `/demo` 路由供外部檢視。

### 2.2 技術架構（已由程式碼驗證）

| 層 | 內容 | 證據 |
|---|---|---|
| 前端 | Next.js 16.2.10（App Router、Turbopack、Proxy）、React 19、Tailwind v4、Recharts | `package.json`、`src/proxy.ts` |
| 後端 | Supabase（Auth + Postgres + RLS + service-role cron）、Server Actions + Zod | `src/lib/supabase/`、`src/lib/schemas/` |
| 資料模型 | `profiles` / `accounts` / `transactions` / `account_snapshots`（每帳戶每日一筆）+ `recurring_plans` / `recurring_plan_runs` / `alerts` / `notifications` | `supabase/schema.sql`、`supabase/rpc-mutations.sql` |
| 計算層 | `buildDashboardData` 純函式（400 行）、`xirr.ts`（69 行，Newton-Raphson + 殘差驗證）、`metrics.ts`（TWR / Sharpe / drawdown，203 行） | `src/lib/dashboard-data.ts` 等 |
| 報價 | provider router（`src/lib/prices/{twelvedata,finmind,coingecko,fx,router,http}.ts`），免費額度 + cooldown | 程式碼驗證 |
| 寫入路徑 | `apply_account_mutation` / `execute_recurring_plan_mutation` Postgres RPC，單一交易內完成帳戶增量 + transaction + snapshot + ledger，`(plan_id, scheduled_date)` unique key 保證冪等 | `supabase/rpc-mutations.sql`、`docs/ARCHITECTURE.md` |
| 認證 | Email/密碼 + Google OAuth + TOTP MFA（AAL2） | AGENTS.md + `src/app/auth/` |

### 2.3 驗證基準（2026-07-22 本地實測）

| 項目 | 結果 |
|---|---|
| `npm run lint` | 通過 |
| `npm run typecheck` | 通過（0 error） |
| `npm run test:unit` | **16 檔 / 117 測試全過**（1.26s） |
| `npm run test:integration` | **未執行**——本機無 `TEST_DATABASE_URL`（無本地 Postgres），未建立假憑證；CI 內以 postgres:16 service 執行 |
| `npm run build` | **本地無法完成**——沙盒環境 EXDEV 錯誤（next-swc 快取跨磁碟 rename），屬環境限制非專案問題 |
| GitHub Actions | 最近 3 次 run（至 2026-07-18）全部 success，五道 gate 含 build 皆過 |

另記錄：檢查時工作樹存在未 commit 的 WIP（`src/app/activity/actions.ts`、`src/lib/account-mutation.ts`、`supabase/rpc-mutations.sql` 等），本研究未觸碰。

### 2.4 工程優點 / 風險（研究者判斷，依據標注）

優點（程式碼驗證）：
- 計算層是純函式且被 demo 與正式頁共用，demo 不是 mockup——這在本次調查的 22 個專案中只有 Maybe（`app/models/demo/`）有同等做法。
- XIRR solver 每條出口路徑驗證 `|NPV(rate)|` 殘差；Portfolio Performance 的 `IRR.java` 用的是「二分法找初始猜測 + Newton」策略，兩者是不同取捨（見 9.2）。
- 寫入路徑收斂到兩個 Postgres RPC，冪等設計明確。
- CI 五道 gate 含真 Postgres 整合測試——小型個人專案少見。

風險：
- **匯率單值**：`accounts.last_fx_rate` 只存最新匯率，cost basis 有已知累積誤差（AGENTS.md 第十節自承，程式碼驗證：`schema.sql` 無歷史匯率表）。
- **無 release/tag**：`git tag` 為空、GitHub releases 為 0（API 驗證）。回滾依賴逐 commit。
- **無 E2E**：測試皆為 Vitest 單元/整合，無瀏覽器層驗證（程式碼驗證：無 Playwright/Cypress 依賴）。
- **元件抽象債**：4 種按鈕風格散在各頁（AGENTS.md 自承的 trade-off）。
- **單一資料來源單點**：每個市場只有一個 provider，無 fallback（`src/lib/prices/router.ts`）。

### 2.5 拿去搜尋對標的特徵

多資產 + 多幣別 + 基準幣別換算、XIRR/TWR 並列、每日 snapshot 趨勢、免費報價 API + cron、self-hosted / 單人、Next.js + Postgres。

## 3. 搜尋範圍與搜尋詞

GitHub Search API（`gh api search/repositories`），2026-07-22 執行。實際使用的查詢：

- 產品類：`portfolio tracker stars:>50`、`net worth tracker stars:>20`、`investment dashboard stars:>50`、`wealth management stars:>100`、`dividend tracker stars:>20`、`crypto portfolio tracker stars:>50`
- Topic 類：`topic:portfolio-tracker stars:>20`、`topic:personal-finance stars:>500`
- 技術棧類：`stock portfolio nextjs stars:>20`（**0 筆有效結果**——與 StackWorth 同棧且有規模的公開專案幾乎不存在）、`portfolio tracker supabase`（僅個位數 star 的早期專案）、`self-hosted finance stars:>100`
- 指名查證（訓練知識中已知、逐一以 API 驗證現況）：maybe-finance/maybe、actualbudget/actual、firefly-iii、paisa、fava、OpenBB、lightweight-charts

限制說明：`stock tracker typescript` 查詢被大量無關政治宣傳 repo 污染，該組結果棄用。

## 4. 資料蒐集日期

全部 GitHub metadata（stars、pushed_at、releases、issues、licenses、目錄樹、檔案內容）取自 2026-07-22 的 GitHub API 即時查詢。星數與活躍度會隨時間變動。

## 5. 候選長名單（22 個）

Star/fork 僅列參考，不作為品質依據。「最近推送」為 `pushed_at`。

| # | 專案 | 定位 | 語言/棧 | License | Stars | 最近推送 | 最新 release | 類型 |
|---|---|---|---|---|---|---|---|---|
| 1 | [ghostfolio/ghostfolio](https://github.com/ghostfolio/ghostfolio) | 開源 wealth management（web） | TS：Angular+NestJS+Prisma+Nx | AGPL-3.0 | 8,998 | 2026-07-22 | 3.31.0（2026-07-20） | A 直接競品 |
| 2 | [portfolio-performance/portfolio](https://github.com/portfolio-performance/portfolio) | 桌面投資績效計算（2012 至今） | Java/SWT | EPL-1.0 | 3,976 | 2026-07-21 | 0.86.0（2026-07-16） | A 直接競品 |
| 3 | [wealthfolio/wealthfolio](https://github.com/wealthfolio/wealthfolio) | local-first 桌面+行動追蹤器 | Rust+Tauri+React | AGPL-3.0 | 8,349 | 2026-07-14 | v3.6.2（2026-07-13） | A 直接競品 |
| 4 | [rotki/rotki](https://github.com/rotki/rotki) | 隱私優先 portfolio tracker（重加密資產） | Python+Rust+Vue | AGPL-3.0 | 3,953 | 2026-07-22 | v1.43.2（2026-06-18） | A 直接競品 |
| 5 | [maybe-finance/maybe](https://github.com/maybe-finance/maybe) | 個人財務 app（**已封存 2025-07**） | Ruby on Rails | AGPL-3.0 | 54,365 | 2025-07-24 | v0.6.0（final） | B 相鄰（產品/domain 標竿） |
| 6 | [actualbudget/actual](https://github.com/actualbudget/actual) | local-first 預算工具 | TS monorepo | MIT | 27,660 | 2026-07-22 | v26.7.0（2026-07-02） | B 相鄰（工程標竿） |
| 7 | [ananthakumaran/paisa](https://github.com/ananthakumaran/paisa) | ledger 型個人財務管理 | Go+Svelte | AGPL-3.0 | 3,183 | 2025-12-02 | v0.7.4（2025-08-03） | B 相鄰（文件/報表標竿） |
| 8 | [firefly-iii/firefly-iii](https://github.com/firefly-iii/firefly-iii) | self-hosted 個人財務管理 | PHP/Laravel | AGPL-3.0 | 24,101 | 2026-07-21 | 持續 | B 相鄰 |
| 9 | [investbrainapp/investbrain](https://github.com/investbrainapp/investbrain) | 投資追蹤（LLM 輔助） | PHP/Laravel | Other（非標準） | 870 | 2026-07-08 | v1.3.0（2026-06-26） | A（降級：license） |
| 10 | [mayswind/ezbookkeeping](https://github.com/mayswind/ezbookkeeping) | 輕量 self-hosted 記帳 | Go | MIT | 5,273 | 2026-07-20 | v1.6.1（2026-07-20） | B 相鄰 |
| 11 | [RIP-Comm/sossoldi](https://github.com/RIP-Comm/sossoldi) | 行動端 net worth app | Flutter/Dart | MIT | 1,377 | 2026-06-19 | 0.3.2（2026-02-21） | B（早期） |
| 12 | [beancount/fava](https://github.com/beancount/fava) | Beancount web 介面 | Python+Svelte | MIT | 2,534 | 2026-07-13 | — | C 技術標竿 |
| 13 | [spacious-team/investbook](https://github.com/spacious-team/investbook) | 投資績效（俄羅斯券商） | Java | AGPL-3.0 | 324 | 2026-06-30 | v2026.1 | A（市場特化） |
| 14 | [GiuseppeDM98/net-worth-tracker](https://github.com/GiuseppeDM98/net-worth-tracker) | net worth + 自動報價 | TS+Firebase（含 tests/Storybook） | AGPL-3.0 | 70 | 2026-07-22 | v7.0.0（2026-05-25） | 同儕（非標竿） |
| 15 | [securo-finance/securo](https://github.com/securo-finance/securo) | self-hosted 個人財務 | Python | AGPL-3.0 | 1,207 | 2026-07-21 | v0.13.10 | B（新興，待觀察） |
| 16 | [eitchtee/WYGIWYH](https://github.com/eitchtee/WYGIWYH) | self-hosted 財務追蹤 | Python/Django | AGPL-3.0 | 869 | 2026-07-18 | 0.22.1 | B 相鄰 |
| 17 | [taoteh1221/Open_Crypto_Tracker](https://github.com/taoteh1221/Open_Crypto_Tracker) | 加密資產私人追蹤 | PHP | GPL-3.0 | 119 | 2026-07-20 | 6.01.08 | 排除（見 §6） |
| 18 | [krishnakuruvadi/portfoliomanager](https://github.com/krishnakuruvadi/portfoliomanager) | 印度市場投資目標追蹤 | Python/Django | GPL-3.0 | 91 | 2026-06-20 | 無 release | 排除 |
| 19 | [Xtrendence/Cryptofolio](https://github.com/Xtrendence/Cryptofolio) | 加密追蹤（web/mobile/desktop） | JS | AGPL-3.0 | 364 | 2024-04-08 | 2021-09 | 排除 |
| 20 | [renefs/buho-stocks](https://github.com/renefs/buho-stocks) | 股票+股利管理 | Python/Django | GPL-3.0 | 42 | 2026-04-12 | v1.0.5（2025-03） | 排除 |
| 21 | [privatefolio/privatefolio](https://github.com/privatefolio/privatefolio) | AI wealth manager | TS | 非標準 | 70 | 2026-06-01 | beta.48（2025-10） | 排除 |
| 22 | [finanze/finanze](https://github.com/finanze/finanze) | self-hosted net worth 聚合 | TS | **無 license** | 33 | 2026-07-21 | v0.9.2 | 排除（license） |

技術標竿補充（非同類產品，僅子系統參考）：[tradingview/lightweight-charts](https://github.com/tradingview/lightweight-charts)（Apache-2.0，canvas 金融圖表效能）、[OpenBB-finance/OpenBB](https://github.com/OpenBB-finance/OpenBB)（資料 provider 抽象，license 非標準需逐模組確認）。

## 6. 排除的候選與原因

| 專案 | 排除/降級原因 |
|---|---|
| Cryptofolio | 最後 release 2021-09，推送止於 2024；長期停更 |
| Open_Crypto_Tracker | 單一維護者 PHP 專案，架構世代較舊，對 Next.js/Postgres 棧遷移價值低 |
| krishnakuruvadi/portfoliomanager | 無 release、印度市場特化、文件與測試薄弱 |
| buho-stocks | 活躍度低（上次有意義 release 2025-03），規模小於 StackWorth 的參考需求 |
| privatefolio | 長期 beta、非標準 license、推送趨緩；README 完整但產品驗證不足 |
| finanze | **無 license**——預設不可借鑑程式碼；僅記錄存在 |
| investbrain | 降級不深入：license 標示為「Other」（非 OSI 標準條款），借鑑程式碼有風險；產品本身活躍 |
| wealthbot、cointop、CryptoShadow、exilence 等 | 已封存或停更多年 |
| GiuseppeDM98/net-worth-tracker | 非排除而是**重新分類為同儕**：TypeScript+Firebase、有 `__tests__`/Storybook/CLAUDE.md，與 StackWorth 同屬「AI 協作的個人專案」世代，成熟度相當，不構成「明顯更高」的標竿；值得互相觀摩但不列入選 |
| shadcn-openai-plaid-dashboard 等 | 模板/展示性質，README 強於程式碼 |
| `portfolio tracker supabase` 搜尋結果全數 | 皆為個位數 star 的早期或練習專案，完成度低於 StackWorth |

## 7. 成熟度評分方法

20 個維度（相似度 / 功能完成度 / 真實可用性 / UI 一致性 / UX 資訊架構 / 行動體驗 / a11y / 程式結構 / domain model / 金融計算可信度 / 資料同步與恢復 / 效能 / 測試 / CI 與 release / 文件 / 安全隱私 / 維護活躍度 / 部署自架 / 擴充性 / 對 StackWorth 學習價值），每項 0–5。三個總軸**分開計**：

- **相似度**＝維度 1 為主
- **成熟度**＝維度 2–19 的證據加權印象分（下表附主要證據）
- **學習價值**＝維度 20，考慮「概念可遷移性」而非「程式碼可複製性」

誠實聲明：行動體驗與 a11y 兩維僅對有公開 demo 或文件描述者部分驗證，未逐一以輔助工具實測；下表這兩維不單獨列分，僅併入敘述。

## 8. 最終入選專案（7 個）

| 專案 | 相似度 | 成熟度 | 學習價值 | 一句話定位 |
|---|---|---|---|---|
| Ghostfolio | 5/5 | 4.5/5 | **5/5** | 與 StackWorth 目的最一致、活躍度最高的直接競品 |
| Portfolio Performance | 4/5 | 5/5 | **4.5/5** | 績效計算 domain 的 14 年老兵；桌面棧不可搬但演算法與文件可學 |
| Wealthfolio | 4.5/5 | 4/5 | **4.5/5** | local-first + 匯入 UX + 行動圖表；UI 完成度高 |
| rotki | 3.5/5 | 4/5 | 3/5 | 事件式帳務與隱私架構；加密資產權重高於 StackWorth 需求 |
| Maybe（已封存） | 4/5 | 4/5（凍結） | **4.5/5** | domain modeling 與 demo 資料工程的教科書；只學概念不追隨架構 |
| Actual | 2/5 | 5/5 | 4/5 | 工程紀律標竿：monorepo 邊界、自訂 lint、release cadence |
| Paisa | 2.5/5 | 3.5/5 | 3.5/5 | 文件與報表呈現標竿；維護趨緩（最後推送 2025-12） |

評分依據要點（證據見 §9）：Ghostfolio 扣 0.5 是因 open issues 274 且部分功能綁 premium；Wealthfolio 成熟度 4 是因 v3 大改版後 open issues 338、AI 功能引入速度快於穩定化；Maybe 成熟度標「凍結」因 2025-07 起無維護，不能作為活的依賴對象。

## 9. 入選專案深入拆解

### 9.1 Ghostfolio（AGPL-3.0）

**產品**：多帳戶、多幣別、股/ETF/加密/現金/另類資產；TWR 與 MWR 並列（與 StackWorth 的 XIRR+TWR 對應）；benchmark 比較、資產配置、FIRE 計算器、公開分享連結、X-ray 規則引擎（過度集中、費用偵測）。有公開 demo（ghostfol.io）。

**工程證據**（皆為 2026-07-22 API 讀取）：
- **計算器架構**：`apps/api/src/app/portfolio/calculator/` 下按指標分目錄（`mwr/`、`roai/`、`roi/`），共用 `portfolio-calculator.ts` 基底 + `portfolio-calculator.factory.ts` 工廠。
- **情境化回歸測試**：`roai/` 內 20+ 個 spec，每檔一個真實情境——`portfolio-calculator-baln-buy-and-sell-in-two-activities.spec.ts`、`...-msft-buy-with-dividend.spec.ts`、`...-btcusd-short.spec.ts`、`...-liability.spec.ts`。**這是與 StackWorth 測試策略最大的差異**：StackWorth 測不變量（invariants），Ghostfolio 疊加了「具名場景 + 固定 fixture + 精確期望值」層。
- **資料 provider 抽象**：`apps/api/src/services/data-provider/` 下 10 個 provider（alpha-vantage、coingecko、eod-historical-data、financial-modeling-prep、google-sheets、manual、rapid-api、yahoo-finance…）實作同一 interface，外加 `data-enhancer/`。StackWorth 的 `prices/router.ts` 是同構思想的最小版。
- **市場資料為第一級實體**：Prisma schema 有 `MarketData`、`SymbolProfile`、`AccountBalance` 獨立 model，`MarketDataState` enum 管資料狀態；歷史價格/匯率落地存放，而非只存 last value。
- **佇列化資料蒐集**：`services/queues/` + `cron/`（BullMQ 型態），報價抓取與請求路徑解耦。
- **維護訊號**：296 contributors；近三個 closed issues 均在 0–1 天內關閉；release 約每週一版（3.31.0，2026-07-20）；workflows：build-code / docker-image / extract-locales。

**弱點**（避免只說好話）：Angular+NestJS+Nx monorepo 對單人維護是重裝備；open issues 274；部分功能（如某些 provider）綁 Ghostfolio Premium 訂閱，開源版體驗有缺口。

### 9.2 Portfolio Performance（EPL-1.0）

**產品**：桌面應用（Windows/macOS/Linux），True TWR 與 IRR 並列、逐帳戶績效、大量券商 CSV/PDF 匯入器、股利與稅務處理、rebalancing。使用者社群論壇活躍，德語圈標準工具。

**工程證據**：
- `name.abuchen.portfolio/src/.../math/IRR.java`（已讀原始碼）：先以**二分法（halving）在 (0,1) 找變號區間取初始猜測**，再進 Newton（`NewtonGoalSeek`）。StackWorth 的 `xirr.ts` 用固定初始猜測 + 殘差驗證 + null 回退；PP 的策略是提高收斂率，StackWorth 的策略是保證不回傳垃圾值。**兩者互補**：StackWorth 可以在 Newton 失敗時加一層二分法 fallback（僅需 dates/values 已有的資料），把「顯示 —」的頻率降低而不犧牲殘差驗證。
- 測試獨立成 project：`name.abuchen.portfolio.tests/` 內有 `IRRTest`、`RiskTest`、`PerformanceIndexTest`、`PerformanceIndexHeatmapCalculationsTest`——風險指標（drawdown/波動）有專屬測試類。
- 維護：2012 年至今，月更 release（0.86.0，2026-07-16），471 open issues 對應龐大使用者基數。
- 文件：help 站台逐指標解釋 TTWROR 與 IRR 的計算與差異——這正是 StackWorth README「使用者是否能理解數字如何計算」一項的成熟版。

**不可搬**：Java/SWT/Eclipse RCP 整個棧與 web 無關；學演算法與「指標說明文件」的做法即可。

### 9.3 Wealthfolio（AGPL-3.0）

**產品**：local-first（SQLite），桌面 + 行動；持倉、績效、收入、多幣別；CSV 匯入含**欄位對映 UI 與範例檔**；v3 加入 AI assistant 與 device-sync。

**工程證據**：
- Rust core 依 domain 切 crate：`crates/{core, market-data, storage-sqlite, device-sync, connect, ai, agent-tools, spending}`——市場資料、儲存、同步各自成界。
- 匯入 UX：`apps/frontend/public/sample-holdings-import.csv` 直接附範例檔給使用者下載對照。
- 行動端不是縮放版：`performance-chart-mobile.tsx` 與 `performance-chart.tsx` 分檔實作。
- 品質設施：`e2e/` 目錄、component 層測試（`holding-performance-percent.test.tsx`）、`.githooks/`、devcontainer、i18n 5 語系。
- 維護：v3.6.2（2026-07-13），closed issues 樣本 0–1 天回應。

**弱點**：v3 期間功能引入（AI、sync）速度快，open issues 338；Tauri 桌面模型與 StackWorth 的 Vercel serverless 完全不同，架構不可搬。

### 9.4 rotki（AGPL-3.0）

**產品**：隱私優先，資料留本地；加密資產深度（exchange API、DeFi、EVM 鏈）+ 傳統資產；事件式帳務（所有資產變動皆為 history event，再由 processor 推導持倉與損益）。

**工程證據**：Python 後端（`rotkehlchen/`）+ Rust 元件（`colibri/`、`crates/`）+ Vue 前端分層；`rotkehlchen_mock/` 專門的 mock 服務做測試；月度 release（v1.43.2）。

**對 StackWorth 的相關性有限**：StackWorth 的 crypto 僅 CoinGecko 報價層級，rotki 的鏈上帳務深度用不上。可學的是「事件為真相來源、餘額為推導值」的方向——但 StackWorth 的 snapshot 模型是刻意選擇（每日估值 vs 完整事件溯源），不建議推翻。

### 9.5 Maybe（AGPL-3.0，**已封存 2025-07-24**）

**背景**：商業化失敗後開源、再停止維護；README 明示不再維護、fork 需注意商標。54k stars 反映的是歷史熱度，**不是可依賴的活專案**——列入的理由是 Rails codebase 的 domain modeling 品質。

**工程證據**（已讀 `app/models/` 目錄）：
- `entry.rb` + `entryable.rb`：所有帳戶變動統一為 Entry，再多型分派到交易/估值等型別——與 StackWorth `transactions.txn_type` enum 同構，但多了統一的搜尋層（`entry_search.rb`）。
- `holding/{forward_calculator, reverse_calculator, gapfillable, materializer, portfolio_cache, portfolio_snapshot}.rb`、`balance/` 同款：**正向（從交易推餘額）與反向（從餘額推缺口）兩個計算器並存，且 gap-filling 是具名模組**。StackWorth 的 snapshot 缺日目前由圖表層虛線橋接；Maybe 把「補洞」本身變成有測試的 domain 物件。
- `exchange_rate.rb` + `exchange_rate/` concern：**匯率是含日期的第一級資料表**，任何歷史估值用當日匯率——正是 StackWorth cost basis 誤差的正解。
- `app/models/demo/`：demo 資料產生器住在 domain 層，與 StackWorth 的 `demo-data.ts` 同思想，驗證了這條路線。

### 9.6 Actual（MIT）

**定位**：預算工具，與 StackWorth 產品重疊低，純工程標竿。

**工程證據**：`packages/` 14 個套件——`loot-core`（共用核心，內部再分 `platform/`、`server/`、`shared/`、`mocks/`）、`crdt`（同步原語獨立成包）、`component-library`（設計系統獨立成包）、**`eslint-plugin-actual`（自訂 lint 規則把團隊約定變成機器檢查）**、`sync-server`、desktop/mobile 雙 client。月度版號 release（v26.7.0）。MIT license 是入選者中最寬鬆的。

**對 StackWorth 的啟示**：不是搬 CRDT，而是「約定 → lint 規則」與「元件庫從產品碼分離」兩個紀律。

### 9.7 Paisa（AGPL-3.0）

**定位**：ledger 型（plain-text accounting）個人財務，Go 單一 binary + Svelte。文件站（paisa.fyi）+ 線上 demo（demo.paisa.fyi）品質高：每張圖表有「這在算什麼」的說明頁。**維護趨緩**：最後 release 2025-08、最後推送 2025-12，引用其做法時以當時快照為準。

## 10. StackWorth 對標矩陣

「是否適合導入」欄：✅ 導入概念 / ⚠️ 重新設計後導入 / ❌ 不導入。

| 維度 | StackWorth 現況 | 參考專案做法 | 差距 | 導入 | 理由 |
|---|---|---|---|---|---|
| Onboarding | 登入後空狀態 + 手動建帳戶 | Ghostfolio 有引導式建立與 demo 帳戶一鍵體驗 | 中 | ⚠️ | 單人使用下優先級低；`/demo` 已承擔展示職責 |
| 資料輸入 | 手動 + CSV（欄位嗅探） | Wealthfolio 範例 CSV + 對映 UI；PP 數十種券商 preset | **大** | ✅ | AGENTS.md 已列 backlog；先做「匯入預覽 + dry-run」 |
| Portfolio model | account 為中心 + 每日 snapshot | Ghostfolio Order/SymbolProfile/MarketData 分離；Maybe Entry 多型 | 中 | ⚠️ | 只補 MarketData 概念（歷史價格/匯率表），不重構帳戶模型 |
| Transaction model | txn_type enum 4 種 | Maybe entryable 多型 + 統一搜尋 | 小 | ❌ | 現有 enum 足夠，多型是多人產品的需求 |
| 績效計算 | XIRR（殘差驗證）+ TWR，117 tests | PP：二分法 seed + Newton；Ghostfolio：情境 spec 群 | 小（品質相當，策略不同） | ✅ | 加二分法 fallback + 情境 fixture 測試 |
| 價格資料 | 3 provider、last value only、cron 每日 | Ghostfolio 10 provider 同介面 + MarketData 落地 + queue | **大** | ⚠️ | 落地歷史價格/匯率是正確性需求；queue 不需要 |
| 匯率 | `last_fx_rate` 單值 | Maybe/Ghostfolio：含日期匯率表 | **大（正確性）** | ✅ | P0，見 §14 |
| Dashboard | 單頁 hero+趨勢+指標+持倉，active-portfolio 邊界 | Ghostfolio 分頁式（總覽/持倉/績效/配置）| 小 | ❌ | 單人工具單頁密度是優點，不學分頁 |
| 圖表 | Recharts + 觸控 scrub + 虛線缺口 | lightweight-charts canvas 效能；PP heatmap | 小 | ❌ | 資料量（單人每日 snapshot）撐不出 Recharts 瓶頸，不換庫 |
| Responsive | 桌機/手機雙端已重整（階段四） | Wealthfolio mobile 專用圖表元件 | 小 | ✅ | 已採相同思想；持續即可 |
| a11y | 未系統性驗證 | Actual/Ghostfolio 亦無突出宣稱 | 不明 | ⚠️ | 生態普遍弱項；做鍵盤導航與對比檢查即可 |
| Loading/empty/error | loading.tsx/error.tsx/not-found + 「—」原則 | 同級 | 無 | — | 已是強項 |
| 測試 | 117 unit + Postgres 整合，不變量導向 | Ghostfolio 具名情境 spec；PP 風險指標專測 | 中 | ✅ | 疊情境層，不取代不變量層 |
| CI | 五 gate + artifact 上傳 | Actual/Ghostfolio 多 workflow 分工 | 小 | ❌ | 單 workflow 對單人專案是優點 |
| Release | **0 tag、0 release、無 CHANGELOG** | Ghostfolio 週更版號；Actual 月更 | **大** | ✅ | 成本極低的紀律，見 §14 |
| 安全 | RLS + MFA(AAL2) + Zod + CRON_SECRET | Ghostfolio 另有 security policy 文件 | 小 | ✅ | 補 SECURITY.md 一頁即可 |
| 文件 | README 品質高 + REFERENCE + 紀實 PDF | PP 逐指標解釋站；Paisa 圖表說明頁 | 中 | ✅ | 做「指標如何計算」單頁（demo 可連） |
| 部署 | Vercel 一鍵 + Supabase | 多數提供 Docker self-host | 中 | ❌ | 使用者就是作者本人，Docker 化無收益 |
| 可維護性 | 純函式核心 + RPC 收斂；按鈕風格 4 種 | Actual component-library + 自訂 eslint plugin | 中 | ⚠️ | 抽 Button/Card 即可，不建獨立套件 |

## 11. 最值得學習的設計（產品/UX）

1. **匯入預覽與對映**（Wealthfolio）：範例 CSV 可下載、欄位對映可視、匯入前顯示將產生的變動。解決「使用者不敢按下匯入」的信任問題。
2. **指標解釋頁**（Portfolio Performance help / Paisa docs）：每個數字連到「它是怎麼算的」。StackWorth README 已寫給工程師看，缺的是產品內給使用者看的版本。
3. **具名 gap-filling**（Maybe `holding/gapfillable.rb`）：把「資料缺日怎麼補」從圖表層的 if-else 升級為有單元測試的具名行為。
4. **X-ray 型檢查**（Ghostfolio）：對配置的規則式警告（單一資產過度集中等）。StackWorth 的 AllocationTargets drift 標紅已是雛形，可擴充規則而非新建系統。

## 12. 最值得學習的工程實踐

1. **歷史市場資料落地**（Ghostfolio `MarketData` / Maybe `exchange_rate`）：價格與匯率按日期存表，估值查表而非用 last value。
2. **情境化回歸測試**（Ghostfolio `roai/*.spec.ts`）：一檔一情境、固定 fixture、精確期望值，命名即文件。
3. **求根器的雙策略**（PP `IRR.java`）：二分法找初始猜測 → Newton 收斂 → StackWorth 既有殘差驗證作最後防線。
4. **Release 紀律**（Ghostfolio/Actual）：tag + CHANGELOG + 版號，讓「回滾到上個可用版」不依賴翻 commit log。
5. **約定機器化**（Actual `eslint-plugin-actual`）：StackWorth 的 `.claude/rules/`（禁吞錯、禁硬編碼顏色）有一部分可以變成 ESLint 自訂規則，讓 AI 代理與人都被同一套機器檢查約束。

## 13. 不適合 StackWorth 的做法

| 做法 | 來源 | 不導入原因 |
|---|---|---|
| Nx/NestJS/Angular monorepo | Ghostfolio | 單人維護成本遠超收益；StackWorth 的單 app 結構是對的 |
| CRDT local-first 同步 | Actual | 與 Supabase 雲端真相源架構矛盾；單人無多裝置衝突問題 |
| 事件溯源帳務 | rotki/Maybe | snapshot 模型是刻意取捨，推翻它是為了不存在的需求 |
| AI assistant / MCP | Wealthfolio v3 | 表面先進；對「看清自己的錢」核心價值無增益，維護面暴增 |
| 多使用者/family/訂閱 | Maybe/Ghostfolio | 單人工具 |
| i18n 多語系 | Wealthfolio/Ghostfolio | 使用者一人，成本純負 |
| Docker self-host 發行 | Firefly III 等 | 沒有第三方部署需求 |
| 換圖表庫（canvas） | lightweight-charts | 資料量不構成 Recharts 瓶頸；換庫違反 repo 設計規則 |

## 14. 優化 backlog

### P0-1 匯率與價格歷史 snapshot（正確性）

- **問題**：`accounts.last_fx_rate` 單值 + snapshot 內 fx_rate 逐日寫入，但 cost basis 回溯計算用的是寫入當下匯率，AGENTS.md 自承有累積誤差；歷史重算（如改基準幣別）無資料可依。
- **證據**：`supabase/schema.sql`（無匯率歷史表）、AGENTS.md 第十節「匯率歷史 snapshot（修 cost basis 累積誤差）」。
- **參考**：Maybe `app/models/exchange_rate.rb`（日期×幣別對唯一鍵）；Ghostfolio `MarketData` + `exchange-rate-data` service。
- **採用概念**：新表 `fx_rates(date, from_currency, to_currency, rate)`，cron 每日寫入（FinMind 已能供歷史匯率）；估值與 cost basis 查表。**不照搬**：Ghostfolio 的 provider 回填佇列。
- **涉及**：`supabase/`（新 delta SQL）、`src/lib/prices/fx.ts`、`src/lib/dashboard-data.ts`、cron route。
- **複雜度**：M。**風險**：歷史回填的資料來源額度；舊資料遷移需一次性回填腳本。**前置**：無。
- **驗收**：改基準幣別或回看任一歷史日，估值使用當日匯率；新增單元測試「同一筆持倉在匯率變動後 cost basis 不漂移」。

### P1-1 情境化回歸測試層

- **問題**：117 個測試以不變量為主，缺「完整使用者故事 → 精確數字」的 fixture 測試；重構 `dashboard-data.ts` 時對複合情境（買+賣+配息+匯率變動交錯）的保護較弱。
- **參考**：Ghostfolio `apps/api/src/app/portfolio/calculator/roai/portfolio-calculator-*.spec.ts` 命名與結構。
- **採用**：在 `src/lib/` 加 `scenarios/` 測試組，每檔一情境（如「18 個月 DCA + 一次已實現虧損 + 台幣升值」），期望值人工算定並註明算式。demo-data 產生器可重用。
- **複雜度**：M。**驗收**：至少 6 個具名情境；任一情境數字改變時 CI 失敗。

### P1-2 CSV 匯入預覽（dry-run）

- **問題**：`csv-import-helpers.ts` 做欄位嗅探但匯入即寫入；使用者無法先看「會產生哪些交易」。
- **參考**：Wealthfolio 匯入對映 UI + `sample-holdings-import.csv`。
- **採用**：匯入分兩步——解析結果表格預覽（含將被拒絕的列與原因）→ 確認寫入；附一個範例 CSV 下載。**不照搬**：券商 preset（等真實 sample，維持 AGENTS.md 原判斷）。
- **涉及**：`src/app/activity/`（匯入 UI）、`csv-import-helpers.ts`。**複雜度**：M。
- **驗收**：格式錯誤的列在預覽被標示且不阻斷其他列；整合測試覆蓋「預覽≠寫入」。

### P1-3 XIRR 二分法 fallback

- **問題**：Newton 失敗即回 null（顯示「—」）；部分可解情境被放棄。
- **參考**：PP `IRR.java` 的 halving-then-Newton（EPL-1.0，**概念學習，重新實作**，不抄碼）。
- **採用**：Newton 失敗後在變號區間跑二分法，結果仍過既有殘差驗證。**複雜度**：S。
- **驗收**：現有 xirr 測試全過；新增「Newton 震盪但二分法可解」案例。

### P2-1 Release 紀律

- **問題**：0 tag、0 release、無 CHANGELOG（API 驗證）。
- **參考**：Ghostfolio 週更 tag；Actual 月更版號。
- **採用**：從下次改動起打 `v1.0.0` tag + 簡短 CHANGELOG.md；重大 schema 變更在 release notes 標注需跑的 SQL。**複雜度**：S。**風險**：無。

### P2-2 抽出 Button/Card 基礎元件

- **問題**：AGENTS.md 自承 4 種按鈕風格散在各頁。
- **參考**：Actual `component-library` 的分離思想（**只取思想**：建 `src/components/ui/`，不建獨立 package）。
- **複雜度**：M（影響面大，分頁遷移）。**前置**：P1-1 情境測試先行，降低回歸風險。

### P2-3 規則機器化

- **問題**：`.claude/rules/observability.md` 的「禁吞錯」「禁硬編碼顏色」靠代理自律。
- **參考**：Actual `eslint-plugin-actual`。
- **採用**：以 `no-restricted-syntax` / 現成 plugin 先覆蓋兩條高價值規則。**複雜度**：S。

### P2-4 產品內指標說明頁

- **參考**：PP help、Paisa docs。`/demo` 已是展示入口，加一頁 `/methodology` 靜態說明 XIRR/TWR/Sharpe/drawdown 的計算與「為何有時顯示 —」。**複雜度**：S。

### P3（可選）

- 每帳戶 TWR（README 自列 future work；PP 有逐帳戶績效可參考呈現）。
- Allocation X-ray 規則擴充（單一資產 > n% 警示；AllocationTargets 已有 drift 基礎）。
- E2E 煙霧測試：Playwright 對 `/demo` 跑一條「載入 → 切範圍 → 開 benchmark」路徑（Wealthfolio `e2e/` 先例）；放 P3 是因 demo 決定性資料已被單元測試釘住，邊際效益中等。

### 分類彙總

- **立即可做（低風險）**：P2-1 release 紀律、P1-3 XIRR fallback、P2-3 規則機器化、P2-4 指標說明頁
- **一個迭代可完成**：P0-1 匯率歷史表、P1-1 情境測試、P1-2 匯入預覽
- **需架構調整**：P2-2 元件抽取（跨頁遷移）
- **暫不值得做**：§13 全表 + 券商 preset（等真實 sample）+ E2E（P3 觀察）

## 15. 分階段實施路線

1. **第一批（半天級）**：P2-1 → P1-3 → P2-4。零 schema 變更、零架構風險。
2. **第二批（一個迭代）**：P1-1 情境測試 → P0-1 匯率歷史表（測試先行使 P0 遷移有保護網）→ P1-2 匯入預覽。
3. **第三批（有保護網後）**：P2-2 元件抽取 + P2-3。
4. **持續觀察**：每帳戶 TWR、X-ray 規則、E2E。

## 16. 授權與風險

| 專案 | License | 修改/再散布 | 對 StackWorth 的借鑑邊界 |
|---|---|---|---|
| Ghostfolio | AGPL-3.0 | 允許，衍生需開源同授權 | **只學概念與測試命名法**；抄程式碼會把 StackWorth 拖入 AGPL 義務 |
| Portfolio Performance | EPL-1.0 | 允許，weak copyleft | IRR 二分法策略屬通用數值方法，重新實作無虞；不逐行翻譯 Java |
| Wealthfolio | AGPL-3.0 | 同 Ghostfolio | 匯入 UX 流程屬概念層，安全 |
| rotki | AGPL-3.0 | 同上 | 僅架構觀念 |
| Maybe | AGPL-3.0（已封存） | 允許 fork，README 明示商標限制 | domain modeling 概念安全；不得使用 Maybe 品牌 |
| Actual | MIT | 最寬鬆 | 即便如此，本研究仍只建議概念借鑑 |
| Paisa | AGPL-3.0 | 允許 | 文件結構屬概念 |
| finanze | 無 license | **預設保留所有權利** | 不可借鑑任何程式碼 |
| investbrain | 非標準（Other） | 不明 | 不深入、不借鑑碼 |

通則：本報告所有建議均為「概念重新設計」，無任何一項要求複製第三方程式碼、文案或 UI 資產；演算法層（二分法求根）屬公有領域數值方法。

## 17. 尚未驗證的內容

- 各入選專案的**實際執行體驗**：未在本機安裝/執行任何候選專案；行動體驗與 a11y 依文件與程式碼結構推斷，未實測。
- Ghostfolio premium 與開源版的精確功能分界（官網宣傳未逐項查證）。
- Portfolio Performance 論壇活躍度為印象描述，未做量化統計。
- StackWorth 本地 `npm run build` 與整合測試（環境限制，見 §2.3；以 CI 綠燈為替代證據）。
- 長名單中 securo、WYGIWYH、ezbookkeeping 僅 metadata 層檢視，未讀碼。
- 星數/issue 數為 2026-07-22 快照，會變動。

## 18. 來源連結

- StackWorth：https://github.com/zhuang060329-bit/portfolio-tracker （本地程式碼 + CI runs）
- 入選：https://github.com/ghostfolio/ghostfolio · https://github.com/portfolio-performance/portfolio · https://github.com/wealthfolio/wealthfolio · https://github.com/rotki/rotki · https://github.com/maybe-finance/maybe · https://github.com/actualbudget/actual · https://github.com/ananthakumaran/paisa
- 長名單其餘見 §5 表內連結
- 技術參考：https://github.com/tradingview/lightweight-charts · https://github.com/OpenBB-finance/OpenBB
- 關鍵證據檔案：Ghostfolio `apps/api/src/app/portfolio/calculator/`、`apps/api/src/services/data-provider/`、`prisma/schema.prisma`；PP `name.abuchen.portfolio/src/name/abuchen/portfolio/math/IRR.java`；Maybe `app/models/holding/`、`app/models/exchange_rate.rb`；Actual `packages/`；Wealthfolio `crates/`、`e2e/`

## 19. 最終結論

**是否存在明顯更成熟的相似專案？** 是。Ghostfolio、Portfolio Performance、Wealthfolio 在功能廣度、資料基礎設施、使用者規模與維護節奏上都明顯超過 StackWorth。但在「單人、多幣別、計算可信」這個 StackWorth 自定義的範圍內，它的計算層品質站得住，不需要自卑式重寫。

**最值得深入學習的三個**：
1. **Ghostfolio** — 情境化回歸測試、MarketData 落地、provider 抽象的完整版。
2. **Portfolio Performance** — 求根器工程與「指標如何計算」的使用者文件。
3. **Wealthfolio** — 匯入預覽/對映 UX 與行動端專用圖表元件。

**最大差距是什麼？** 不是功能數量，也不是計算品質，而是**資料基礎設施（歷史匯率/價格未落地）與工程營運紀律（無 release/tag/changelog）**。前者是唯一的正確性風險，後者是成本最低的補課。

**最高 ROI 五項**：① 匯率歷史表（P0-1）② 情境化回歸測試（P1-1）③ 匯入預覽 dry-run（P1-2）④ release 紀律（P2-1）⑤ XIRR 二分法 fallback（P1-3）。

**看似先進但現在不該做**：AI assistant、事件溯源、CRDT 同步、i18n、Docker 發行、換圖表庫、多使用者（§13）。

**是否接近可長期使用 / 公開展示 / v1.0？** 長期使用：已達成（生產環境日用，CI 綠）。公開展示：`/demo` + README 已具說服力，補上指標說明頁與 release tag 後即完整。v1.0 發布：完成 P0-1 匯率歷史表（消除已知正確性誤差）並打上第一個 tag，就有資格稱 v1.0——差的不是功能，是那一個 tag 和一張匯率表。
