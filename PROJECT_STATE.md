# PROJECT_STATE

> 產出日期：2026-06-15
> 僅針對 `portfolio-tracker`（StackWorth）repo 據實盤點；git 狀態皆在本 repo 內判斷。
> 本次只做狀態盤點：未改產品程式碼 / README / package.json / env / Supabase / Vercel / CI 設定，未跑 formatter / migration / test。

## Repo Identity

* Repo path: `D:\ClaudeCode\projects\portfolio-tracker`
* Repo type: Next.js 16 全端 Web App（git repo，有 GitHub remote）
* Primary purpose: 個人多市場 / 多幣別投資組合追蹤（StackWorth），已上線；同時作為作品集展示
* Current status: Maintenance（生產運作中；以收尾 / 文件一致性 / 作品集穩定化為主，不開新功能）

## Git Status

* Branch: `main`
* Latest commit: `0d5a564 修正 README 截圖與環境變數說明`
* Working tree: clean（`git status --short` 無輸出）
* Remote: `origin` → `https://github.com/zhuang060329-bit/portfolio-tracker.git`（依 AGENTS.md 為 private）
* Sync status: 與 `origin/main` 同步（`## main...origin/main`，無 ahead / behind）

## Product Status

* Production / deployment: 上線於 Vercel（`https://portfolio-tracker-two-rho.vercel.app`），GitHub 自動部署；Vercel Cron 每日 `0 6 * * *`（台北 14:00）
* README / portfolio status: 已是作品集狀態（StackWorth 標題、live demo、features、tech stack、財務邏輯說明、截圖隱私說明、Author）
* CI status: 有 GitHub Actions `.github/workflows/ci.yml`，push / PR 到 main 觸發 `typecheck → test → build`（build 用 placeholder Supabase env）；另有 `.github/dependabot.yml`（npm，weekly）
* Test status: Vitest；**測試數量文件互相衝突**——README 寫 49 tests / 6 files，AGENTS.md 與 `.claude/rules` 寫 39；本次未執行測試，無法判定即時數字
* Known limitations: 無 server action 整合測試（README 自述）；env var 命名於 AGENTS.md 與 README/CI 不一致（見下方 Tech Stack 註）；docs 測試數字未對齊

## Tech Stack

* Framework: Next.js 16.2.6（App Router、Turbopack、Proxy 取代 Middleware）+ React 19
* Database: Supabase Postgres + RLS（SQL 檔在 `supabase/`，執行順序見 `supabase/README.md`）
* Auth: Supabase Auth（Email/密碼 + Google OAuth + MFA TOTP，AAL2 強制）
* Styling: Tailwind CSS v4 + CSS 變數系統（`[data-theme="dark"]` 深色模式）；圖表 Recharts
* Testing: Vitest（`vitest.config.ts`）
* Validation: Zod v4（server action 輸入；schema 於 `src/lib/schemas/action/`）
* Monitoring: Sentry（`@sentry/nextjs`，Next 16 instrumentation：`src/instrumentation.ts` + `src/instrumentation-client.ts` + `onRequestError` + `src/app/error.tsx`）。**完整接好**，但未設 DSN 時不 init（production-gated，等同 no-op）——非僅部分導入
* Deployment: Vercel Hobby + GitHub auto-deploy；`vercel.json` 設 cron

> env var 命名註記（僅變數名，無 secret）：AGENTS.md 用 `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`；README 與 CI 用 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SECRET_KEY`。兩處不一致，接手前需以實際 `.env.local` / Vercel 面板為準（本次未讀取 secret）。

## Available Commands

（來源：`package.json` scripts，確實存在）
* Lint: `npm run lint`（`eslint`）
* Typecheck: `npm run typecheck`（`tsc --noEmit`）
* Test: `npm run test`（`vitest run`）；watch：`npm run test:watch`
* Build: `npm run build`（`next build`）
* Dev: `npm run dev`（`next dev`）；Windows 後台：`start-dev-min.vbs` / `start-dev.bat`
* Other: `npm run start`（`next start`）

## Completed Work

> 僅依 README、commits、實際檔案整理，未腦補。

* CI / Dependabot：已建立（`ci.yml` typecheck→test→build；`dependabot.yml` weekly npm）。
* Zod validation：已導入，所有 server action 輸入經 Zod 驗證（`src/lib/schemas/action/`）。
* Vitest：已建立並納入 CI（測試檔涵蓋 xirr / metrics / whatif / whatif-project / csv-import-helpers / pnl；數量見上方衝突註記）。
* Sentry：已完整接入（instrumentation + error boundary），DSN 未設則 no-op。
* Dashboard UI polish：近期 commit 修正 Dashboard TWR cashflow 語義等。
* Allocation drift display：已實作（目標 vs 實際，drift > 5% 標紅，`AllocationTargets.tsx`）。
* README repair：近 3 個 commit 整理作品集 README、截圖隱私說明、環境變數說明。
* Production / Vercel status：已上線、cron 運作中。
* 近期 commit 另完成：禁止交易日期填未來、投入交易 / 帳戶更新錯誤處理、XIRR active account 範圍、What-if 實際報酬率、回填歷史交易提示成交價。

## Current Phase

* Phase: 生產後收尾 + 文件一致性維護 + 作品集狀態穩定化
* Goal: 維持四道驗證（lint / typecheck / test / build）全綠與 CI 通過，並讓專案文件對外一致。
* Success criteria: working tree clean、CI 綠燈、README 對外完整、文件數據（測試數 / env 命名）內部一致。

## Next 3 Allowed Tasks

1. 對齊文件數據落差：確認即時 test count，統一 README / AGENTS.md / `.claude/rules` 的測試數字與 Supabase env 命名。
2. 補 server action 整合測試可行性盤點：先列出缺口與測試方案，不直接大改。
3. 最終作品集 closeout 檢查：確認 README、CI、production、隱私說明、截圖策略是否一致。

## Deferred / Explicit Approval Required

> 以下項目**不屬於**目前 Maintenance / 生產後收尾階段，列此僅供記錄，預設不執行。

* **Email 警示接 Resend**
  * 這是**新功能**（非維護 / 收尾範圍）。
  * 不屬於目前 Maintenance / 生產後收尾階段。
  * 只有使用者明確開啟 feature phase 時才可做。

## Forbidden Scope

* Do not change database schema unless explicitly requested.
* Do not expose or print secrets.
* Do not modify env files.
* Do not rewrite completed README sections unless explicitly requested.
* Do not perform broad UI redesign.
* Do not refactor core financial calculations（`xirr.ts` / `metrics.ts` / `whatif.ts`）unless task specifically requires it.
* Do not push without explicit instruction.

## Standard Validation

本 repo `package.json` 實際存在的指令（不存在者標 N/A）：
* Lint: `npm run lint`
* Typecheck: `npm run typecheck`
* Test: `npm run test`
* Build: `npm run build`
* （CI 順序：typecheck → test → build；AGENTS.md / rules 另要求 build 前三道全過才 commit）

## Handoff Prompt

Next assistant / Claude Code session should first read:

* `D:\ClaudeCode\WORKSPACE_STATE.md`
* `CLAUDE.md`（本 repo，內容 `@AGENTS.md`；務必讀 `AGENTS.md` 與 `.claude/rules/`）
* `PROJECT_STATE.md`（本檔）
* `README.md`
* `package.json`
* `git status --short`（在本 repo 內執行，勿用 `D:\ClaudeCode` 根目錄狀態）
* `git log --oneline -5`

Then it should only execute Current Phase or Next 3 Allowed Tasks.
Do not reopen completed phases.
Do not broaden scope.
