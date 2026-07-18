# StackWorth v1 瀏覽器驗收

## 選擇

v1 沒有新增 Playwright。現有 repository 未使用瀏覽器測試框架，加入瀏覽器、CI cache 與認證資料會擴大部署和維護範圍。公開 Demo 改用 `agent-browser` smoke script；需登入的寫入流程保留為測試資料庫與人工驗收清單。

## 執行條件

1. 啟動本機 app。公開 Demo 仍需要兩個 public Supabase 變數通過 root layout 初始化，可使用不含真實憑證的 placeholder：

   ```powershell
   $env:NEXT_PUBLIC_SUPABASE_URL = "https://placeholder.supabase.co"
   $env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "placeholder_key_for_ci"
   npm.cmd run dev -- --port 3100
   ```

2. 另一個 PowerShell 執行：

   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts/browser-smoke.ps1
   ```

`agent-browser` 由 `npx --yes` 暫時取得，不會寫入 `package.json`。若 npm registry 不可用，先在有網路的環境完成一次套件取得。

## 2026-07-18 實際結果

- `/demo`、`/demo/decisions`、`/demo/history`、`/demo/whatif`、`/demo/report` 均載入預期內容，頁面文字沒有 runtime、compile 或 server error。
- 歷史日期由 `2026-07-18` 切到 `2026-07-10`；URL 與「快照 2026-07-10」同步更新。
- 情境套用「台股修正」並試買 TWD 50,000：規則顯示台股價格 -15%，買後總值 TWD 522,690，選定持倉集中度 17.53%，且頁面明示不寫回交易。
- 「全球風險下降」範本下，TWD 300,000 現金保持不變；價格 shock 只套用到非現金、非負債類別。
- 月報由 `2026-07` 切到 `2026-06`，標題與 URL 更新，列印／儲存 PDF 按鈕存在。
- 切換金額遮罩後，`data-privacy=on`、按鈕 `aria-pressed=true`，列印狀態顯示「已遮蔽」。
- 深色模式切換後，`data-theme=dark`，控制項文字改為「切到淺色」。
- 375×812 情境頁、360×800 月報頁、1440×900 歷史頁均未出現 document-level 水平溢位。

## 需登入的人工驗收

需使用獨立測試 Supabase，不可對 production 執行：

1. 建立一筆不連交易的決策，確認 context snapshot、檢討日與列表篩選。
2. 從 activity transaction 建立關聯決策，確認帳戶與 transaction 關係固定。
3. 編輯決策論點，確認原始 context snapshot 未變。
4. 完成檢討，確認 review 與 decision status 同時更新；重複提交不產生第二筆 review。
5. 以第二個使用者嘗試讀取或更新第一個使用者的決策、檢討與狀態歷史，預期無資料或被拒絕。
6. 封存決策，確認預設列表不再顯示，但既有 snapshot 與 review 保留。
7. 列印月報預覽，確認導航與操作按鈕隱藏、背景為白色、區塊沒有不合理截斷，並核對遮罩狀態。

目前本機沒有 `TEST_DATABASE_URL`，所以本次未執行上述認證寫入流程；對應 Postgres 測試已存在，CI 有測試資料庫時會執行。
