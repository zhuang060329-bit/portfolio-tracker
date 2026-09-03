# PROJECT_STATE

> 產出日期：2026-09-03
> 資料來源：本 checkout 的實測——`git`、`gh`、`npm audit`、四道驗收關卡、
> production build 的瀏覽器實測。舊文件一律不當成現況。
> 上一版（2026-07-18，v1.0.0 時期）留在 git 歷史裡，需要時 `git log -p PROJECT_STATE.md` 取回。

## Repository

- Local checkout：`~/ClaudeCode/projects/portfolio-tracker`（2026-07-30 由 Windows 遷至 Mac）
- Remote：`https://github.com/zhuang060329-bit/portfolio-tracker.git`（public）
- Branch：`optimize/2026-09-03`
- Base：`main` at `c6b7eac`「合併：發布 v1.2.0」，共 209 commits
- Package version：`1.2.0`
- 部署：`https://portfolio-tracker-two-rho.vercel.app`（Vercel Hobby + GitHub auto-deploy）
- PR #16（`feat: complete StackWorth v1.0.0`）：**已於 2026-07-18T08:48:20Z merge**。
  舊版狀態檔寫成「Draft、尚未 merge」，那是 v1 開發當下的快照，早已過期。

### 工作區狀態（2026-09-03）

- 分支 `optimize/2026-09-03`，工作區乾淨。48 個改動檔已切成 6 個 commit：

  | commit | 內容 |
  |---|---|
  | `7f5a323` | 排除 markdown 不讓 Tailwind 當模板掃 |
  | `3eca6e8` | `.btn` 系統 + 行動版 `.tap-row`（`globals.css` + 39 個元件） |
  | `a6c86c9` | Sentry 改成動態 import，每頁必載底座少 76 KB |
  | `7889d53` | CSP 公開頁實測完成，並修掉 Report-Only 的假警報 |
  | `bc40425` | 升級 Next 到 16.3.4 並移除 postcss override |
  | 本次 | 文件對齊（`CHANGELOG.md`、本檔） |

- 有三個檔案（`globals.css`、`error.tsx`、`login/page.tsx`）一份裡混了兩個主題，
  是**按 hunk** 分開 stage 的，不是整檔進同一個 commit。
- `AGENTS.md` 的 Sentry 那個 hunk 裡夾了一條 `globals.css` 的說明（同一段連續改動，
  拆不開），它跟著 Sentry 那個 commit 走。這是已知的不乾淨處，不是遺漏。
- **尚未 push**。遠端 `main` 還在 `c6b7eac`。使用者明確指示前不動 git。

## 現況範圍

28 個 `page.tsx` + 5 個 `route.ts`。功能面見 `AGENTS.md` 第三節與 `CHANGELOG.md`，
本檔只記「文件與現況對不上」時該信哪一邊。

## 資料庫

Versioned migration 共 6 支，全在 `supabase/migrations/`：

| 檔案 | 內容 |
|---|---|
| `20260718032234_stackworth_v1.sql` | v1：`account_status_history`、`investment_decisions`、`decision_reviews` |
| `20260810155500_recurring_amount_override.sql` | 定期定額金額覆寫 |
| `20260810230000_transaction_fee.sql` | 交易手續費欄位 |
| `20260810234500_transaction_reversal.sql` | 交易沖銷 |
| `20260811120000_api_budget.sql` | 報價 API 每日預算計數 |
| `20260818130000_reversal_negative_fee.sql` | 沖銷的負手續費修正 |

另有 `supabase/*.sql` 9 支非 versioned 的建置腳本（執行順序見 `supabase/README.md`）。

> production 是否已套用某支 migration，**repo 裡查不到**，只能連 DB 查。
> 這一點過去踩過，別再從檔案存在推論已執行。

## 2026-09-03 驗收（四道關卡，實跑）

下表是**相依升級之後重跑**的結果，不是升級前的舊值。

| Gate | 結果 |
|---|---|
| `npx tsc --noEmit` | 通過，0 error |
| `npx eslint src` | 通過，0 error 0 warning |
| `npx vitest run` | 33 files 通過 / 3 skipped；299 tests 通過 / 33 skipped |
| `NEXT_TELEMETRY_DISABLED=1 npx next build` | 通過 |

3 個 skipped 檔案是 Postgres 整合測試，需要 `TEST_DATABASE_URL`，本機沒設。

## 2026-09-03 這次的改動

### 1. CSP 公開頁實測完成（`src/lib/csp.ts`）

用 production build（`next start -p 3210`）在真實瀏覽器繞過
`/demo`、`/demo/whatif`、`/demo/report`、`/demo/history`、`/login`，
console **沒有任何 `Refused to …` 或 `[Report Only] Refused …`**。

順手修掉一個假警報：`upgrade-insecure-requests` 在 Report-Only 政策裡
依規範無效，Chrome 每次載入都會印一則 error 說它被忽略。現在改成
只有 `CSP_ENFORCE` 為 true 時才送出，翻旗標時語意不變。
`csp.test.ts` 有一條測試把這個關聯釘住。

**還沒驗的**：登入後的頁面、`/settings` 的 MFA QR、Google OAuth。
那些要真實帳號才進得去，得由使用者操作。`CSP_ENFORCE` 在那之前不翻。

### 2. Sentry 改成動態 import（`instrumentation-client.ts`、`app/error.tsx`）

`import * as Sentry` 會把整包 SDK 拉進「每頁必載」的底座 chunk，
而且即使 `NEXT_PUBLIC_SENTRY_DSN` 沒設、那個 if 在建置期就是 false，
bundler 仍然不敢 tree-shake（SDK 有 side effect）。

實測（只算當次 manifest 引用到的 chunk，避開 `.next/static` 的舊檔殘留）：

| | 每頁必載底座 |
|---|---|
| 靜態 import（改動前） | 244.6 KB gzip（7 檔） |
| 動態 import（改動後） | **168.5 KB gzip（7 檔）** |

每開任何一頁省 76.1 KB，約 31%。代價是 Sentry 變成非同步載入，
瀏覽器剛啟動那一瞬間的錯誤可能來不及捕捉。

### 3. 相依升級：Next 16.2.11 → 16.3.4，並拿掉 `overrides`

`npm audit` 原本回報 8 個 high，全部指向 `next` 自己。升級 `next`、
`eslint-config-next` 到 16.3.4，並把 `react-dom` 從 19.2.7 補到 19.2.8
（原本與 `react` 19.2.8 不同步）。升級後 `npm audit` = **0 vulnerabilities**。

順手刪掉 `package.json` 的 `overrides`：

```
"overrides": { "next": { "postcss": "8.5.10" } }
```

這一條**寫下當時是修補，現在是降版**。`next@16.3.4` 自己帶的是
`postcss@8.5.23`，比釘住的 8.5.10 新；留著等於把已修好的相依壓回舊版本。
這類 override 沒有到期日，不會有人提醒，只能靠升級時順手複查——
**日後再加 override 時，請一併寫下「什麼條件成立就該刪掉它」。**

`eslint-config-next` 16.3.4 新增了 `@next/next/no-location-assign-relative-destination`
規則，打到 `src/app/login/page.tsx:95` 的 `window.location.href = "/"`。
那一行是刻意的整頁重載（`signInWithPassword` 剛寫完 session cookie，
client 端導航拿到的 RSC payload 可能還是舊 session 算出來的），
所以加了 `eslint-disable-next-line` 並在旁邊寫明理由，沒有改行為。

每頁必載底座在升級後從 168.5 KB gzip（7 檔）降到 **165.9 KB gzip（6 檔）**，
是 Next 自己的框架底座變小，不是本次改動的功勞。

## 已知限制

- ~~npm audit：8 個 high~~ → **2026-09-03 已升級修掉，現在 0 vulnerabilities**（見下方第 3 節）。
- replay／月報的 snapshot 查詢上限 10,000 筆，達上限顯示截斷警告。
- 決策檢討的價格、FX、最大有利／不利變動取決於已保存的 daily snapshots。
- 報告輸出走瀏覽器列印，沒有 server-side Chromium。
- CSV 匯入的交易寫入與帳戶更新不是原子的（見 `AGENTS.md` 第八節）。
- 需登入的流程尚未在本機連真實 Supabase 跑過瀏覽器實測。

## 待使用者決定（不經確認不動）

1. **這 6 個 commit 要不要 push**。目前只 commit 沒 push，
   分支 `optimize/2026-09-03` 只存在本機。要 push 或要先合回 `main`，由使用者決定。
2. **`CSP_ENFORCE` 翻 true**。要先由使用者登入實測（登入後的頁面、
   `/settings` 的 MFA QR、Google OAuth 這三處我沒有帳號可以測），見上。

> 原第 1 點「相依升級」、原「切 commit」一項皆已於 2026-09-03 執行完畢。

## Handoff

接手的 session 先讀：`AGENTS.md`（`CLAUDE.md` 內容即 `@AGENTS.md`）、
`.claude/rules/`、本檔、`CHANGELOG.md`、`package.json`，
再在**本 repo 內**跑 `git status --short` 與 `git log --oneline -5`
（不要拿工作區根的狀態當本 repo 的狀態）。
