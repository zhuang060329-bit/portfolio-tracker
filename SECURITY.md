# 安全性政策

StackWorth 是單一使用者的個人投資組合追蹤工具，處理的是真實財務資料。安全性回報一律歡迎。

## 支援版本

專案採滾動更新，僅維護 `main` 分支的最新狀態；安全性修補只針對最新版提供。

| 版本 | 是否維護 |
|---|---|
| `main`（最新） | ✅ |
| 舊 commit / 個別部署 | ❌ |

## 回報漏洞

**請勿以公開 issue 回報安全性問題。**

請使用 GitHub 的私密漏洞回報：至本專案的 **Security → Report a vulnerability**（Private vulnerability reporting）開啟通報。此管道僅維護者可見。

回報時請盡量附上：

- 影響範圍與嚴重性（例如可讀取他人資料、繞過認證、洩漏憑證）。
- 重現步驟或 PoC。
- 受影響的檔案、路由或 server action。

因為是個人專案、單人維護，回應時間無法保證，但會盡快確認並處理。

## 範圍

特別關注：

- Supabase RLS 繞過（跨使用者資料存取）。
- 認證與 MFA（AAL2）繞過。
- Server action 或 API route 的授權缺口。
- 憑證 / API key / service-role key 洩漏（log、Sentry、回應或 client bundle）。
- cron 路由（`CRON_SECRET`）驗證繞過。
- CSV 匯入 / 匯出的注入或資料外洩。

## 不在範圍

- 需要實體或已登入本機存取才能觸發的問題。
- 第三方報價服務（Twelve Data / FinMind / CoinGecko）本身的問題。
- 缺少 security header 但無實際可利用性的純評分工具告警。

## 揭露原則

修補上線前請勿公開細節。修補後可協調揭露。
