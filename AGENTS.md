<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# StackWorth 專案交接文件

這是個人投資組合追蹤工具，已上線運作中。本檔給任何接手的 AI 代理人（Claude Code / Codex CLI / Cursor / Windsurf / Aider 等）看，提供完整脈絡。

## 一、專案基本資料

- **路徑（Windows）**：`D:\ClaudeCode\portfolio-tracker`
- **GitHub**：`github.com/zhuang060329-bit/portfolio-tracker`（public）
- **部署**：`https://portfolio-tracker-two-rho.vercel.app`
- **當前狀態**：上線運作中；v1.0 原始碼有 32 個 app page/API 入口，測試數量以 `npm run test:unit` 與 `npm run test:integration` 實際輸出為準
- **完整背景文件**：`docs/StackWorth-專案紀實.pdf`（15 頁，繁中）

## 二、技術棧

| 層 | 選擇 |
|---|---|
| 前端框架 | Next.js 16.2.10（Turbopack；Proxy 取代 Middleware；async cookies、async params） |
| React | 19（useActionState、useSyncExternalStore、Suspense for useSearchParams） |
| 樣式 | Tailwind v4，`@custom-variant dark` 對應 `[data-theme="dark"]` |
| 圖表 | Recharts |
| 後端 | Supabase（Auth + Postgres + RLS + service-role for cron） |
| 認證 | Email/密碼 + Google OAuth + MFA TOTP（AAL2 強制） |
| 部署 | Vercel Hobby + GitHub auto-deploy |
| 排程 | Vercel Cron 每日 06:00 UTC（= 台北 14:00） |
| 報價 | Twelve Data（美股 + USD/TWD）、FinMind（台股 + 0050 + 歷史匯率）、CoinGecko（加密） |
| 測試 | Vitest（測試數量以 `npm run test` 實際輸出為準） |
| 監控 | Sentry SDK（DSN 未設則 no-op） |

## 三、目錄重點

```
src/
├── app/
│   ├── page.tsx                 ← 首頁（hero + 圖表 + 指標 + holdings）
│   ├── accounts/[id]/           ← 帳戶詳情 + actions（addByAmount, sellQuantity, ...）
│   ├── accounts/new/{stock,crypto,manual}/  ← 新增帳戶（client components）
│   ├── activity/                ← 變動紀錄列表 + CSV 匯入
│   ├── alerts/                  ← 警示 CRUD
│   ├── notifications/           ← 通知中心
│   ├── decisions/               ← 決策日誌 + 檢討
│   ├── history/                 ← 歷史重播 + 報酬歸因
│   ├── reports/monthly/         ← 月報 + 列印輸出
│   ├── whatif/                  ← What-if + 投資組合壓力測試
│   ├── admin/allowlist/         ← Admin 使用者管理
│   ├── auth/{callback,mfa,reset-password,signout}/
│   ├── api/cron/refresh/        ← Vercel cron 入口
│   ├── api/export/csv/          ← 全部交易 CSV
│   ├── api/export/tax-csv/      ← 年度稅務報表
│   ├── login/, settings/
│   ├── layout.tsx, loading.tsx, error.tsx, not-found.tsx
│   └── globals.css              ← CSS 變數系統
├── components/
│   ├── AppHeader.tsx            ← 導覽 + 鈴鐺（unreadCount prop）
│   ├── PortfolioCharts.tsx      ← AllocationPie, NetWorthLine, PerformanceLine
│   ├── NetWorthPanel.tsx        ← 範圍切換（1M/3M/6M/1Y/ALL）+ NetWorthLine
│   ├── PerformancePanel.tsx     ← 範圍切換 + benchmark toggle + PerformanceLine
│   ├── AllocationTargets.tsx    ← 目標 vs 實際（drift > 5% 標紅）
│   ├── QuickAddFab.tsx          ← 首頁右下浮動 + 快速記帳
│   └── ThemeToggle.tsx          ← useSyncExternalStore 實作
├── lib/
│   ├── prices/                  ← {twelvedata,finmind,coingecko,fx,router,types,http}.ts
│   ├── xirr.ts, metrics.ts      ← 報酬指標（含測試）
│   ├── whatif.ts                ← Buy-and-hold 模擬（含測試）
│   ├── csv-import-helpers.ts    ← 欄位嗅探、別名（含測試）
│   ├── alerts-scan.ts           ← cron 內呼叫的警示掃描
│   ├── alert-actions.ts, allowlist-actions.ts, profile-actions.ts
│   ├── contributions.ts         ← applyContribution 共用 helper
│   ├── notifications.ts         ← getUnreadCount
│   ├── admin.ts                 ← isAdmin(email)
│   ├── dates.ts                 ← todayTaipei()
│   └── supabase/{server,client,service,proxy}.ts
└── proxy.ts                     ← 根 proxy 入口（matcher 排除 static / cron）

supabase/                        ← SQL 檔（執行順序見 supabase/README.md）
├── schema.sql, recurring-plans.sql, cost-basis.sql,
├── realized-pnl-cashflow.sql, batch2-schema.sql,
├── open-signup.sql, alerts.sql

docs/
├── StackWorth-專案紀實.pdf      ← 完整背景（小白版）
└── build_pdf.py                 ← 生成腳本（reportlab + 微軟正黑體）

vercel.json                      ← Cron 設定 0 6 * * *
vitest.config.ts                 ← 測試設定（數量以 npm run test 為準）
```

## 四、環境變數

在 Vercel 已設、本機在 `.env.local`：

| 變數 | 用途 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 專案 URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public publishable key |
| `SUPABASE_SECRET_KEY` | cron / admin 用，繞過 RLS（即 service-role 金鑰） |
| `TWELVE_DATA_API_KEY` | 美股報價 + USD/TWD |
| `FINMIND_TOKEN` | 台股 + 歷史匯率 |
| `CRON_SECRET` | Bearer token 驗證 cron 路由 |
| `ADMIN_EMAILS` | 逗號分隔 admin email（未設則無 admin） |
| `SENTRY_DSN`（選用） | 設了才會回報 |

## 五、開發 / 驗證指令

```bash
cd portfolio-tracker

# 型別
npx tsc --noEmit

# Lint
npx eslint src

# 單元測試
npm run test:unit

# Postgres 整合測試（需要獨立測試資料庫）
TEST_DATABASE_URL=postgresql://... npm run test:integration

# 完整 build（自動跑 tsc）
NEXT_TELEMETRY_DISABLED=1 npx next build

# 本機開發
npm run dev   # 或 .\start-dev-min.vbs（Windows 後台模式）
```

## 六、上線流程

1. 改 code → 跑 lint、typecheck、單元測試、Postgres 整合測試、production build
2. `git commit` → push 功能分支 → 建立 PR
3. Vercel 自動部署（GitHub webhook）
4. 若 schema 變更：先在測試環境驗證 versioned migration，再由使用者核准正式環境套用

## 七、重要設計決策

- **顏色慣例**：賺綠虧紅（西方慣例，非台股紅漲綠跌）— 因為 UI 對國際使用者開放
- **XIRR**：資料 < 30 天不顯示（避免短期波動年化後失真，例 5 天虧 10% 算成 -99% 年化）
- **Total return**：已實現損益 = 0 時不顯示（避免和「未實現」重複）
- **Performance benchmark**：SPY/QQQ 必須 × 當日 USD/TWD 換成 TWD 才能與組合公平比較
- **TWR vs XIRR**：TWR 剔除現金流時機，反映策略；XIRR 是現金流加權，反映實際投入回報
- **What-if 模擬**：只算「投入」（負現金流），buy-and-hold，不考慮配息再投資/交易成本
- **AppHeader unreadCount**：每個 server page 自己 fetch 傳入（保持 sync 元件，避免 client pages 不能 render async server component 的問題）
- **CSS 變數系統**：避免硬編碼顏色，深色模式靠 `[data-theme="dark"]` 自動翻轉
- **手動帳戶**：不適用 addByAmount；FAB 與部分 query 自動排除
- **服務選擇**：全部用免費額度可運作；個人單用不會撞限

## 八、已知 trade-off（暫不動）

| 項目 | 為什麼 |
|---|---|
| 4 種按鈕風格散在各頁 | 提取成 Button component 影響面大，現有體驗 OK |
| AppHeader unreadCount 每頁 fetch | DRY 違規但只是一個 COUNT query，成本低 |
| serif 標題 + sans-serif 內文 | 設計取向決定，等使用者明說再改 |

## 九、使用者操作（程式碼無法代勞）

部署後仍待使用者完成：

1. **必做**：到 Supabase SQL Editor 跑 `supabase/alerts.sql`（alerts + notifications 兩張表）
2. **選做**：要 email 警示就在 Vercel 加 `RESEND_API_KEY`，告知 AI 接 Resend SDK 到 `alerts-scan.ts`
3. **例行**：每年 5 月報稅前到 `/settings` 下載年度稅務報表 CSV

## 十、未做但討論過的功能（按曾認可的優先級）

| 優先 | 項目 | 工作量 |
|---|---|---|
| 高 | Email 警示（接 Resend） | 小 |
| 中 | DRIP 自動再投資（配息觸發加碼） | 小 |
| 中 | 被動收入面板再拆細（月/季/年） | 小 |
| 中 | 多基準幣別（EUR/USD as base — 使用者 2026/6 月可能搬歐洲） | 中 |
| 中 | 匿名 read-only 分享連結 | 中 |
| 低 | 券商 CSV 格式自動辨識（富邦/永豐/Binance/MAX） | 大（需真實 sample） |
| 低 | 自動同步券商持倉（Binance/Coinbase API key） | 大 |
| 低 | 匯率歷史 snapshot（修 cost basis 累積誤差） | 中 |
| 低 | 字體換掉 serif（IBM Plex / Inter） | 小（設計決定） |

## 十一、開發約定

- 每個改動獨立 commit（使用者要求可回滾）
- Commit message 用繁中，簡短說明動機 + 做了什麼 + 驗證結果
- 重大 schema 變更必須提醒「請到 Supabase 跑 supabase/X.sql」
- 不擅自做使用者沒明說的決定；遇到設計方向選擇先問
- 不可逆操作（刪檔、覆寫、rebase --force）執行前先確認
- 跑 build / test 失敗就停下來修，不要 push 失敗的東西

## 十二、近期 commit 歷程（最新在前）

執行 `git log --oneline -20` 看完整紀錄。每個 commit 訊息寫了動機與驗證結果。
完整開發階段見 `docs/StackWorth-專案紀實.pdf` 第 6 章。
