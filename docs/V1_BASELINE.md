# StackWorth v1 基線紀錄

日期：2026-07-18
基線：`origin/main` at `98f808fdee48564ed1ee678c8ce157227888f1fa`
工作分支：`feat/stackworth-v1`

## 已驗證品質閘門

- `npm run lint`：通過。
- `npm run typecheck`：通過。
- `npm run test:unit`：15 個檔案、115 項測試通過。
- `npm run build`：通過；建置時使用與 CI 相同用途的 Supabase placeholder 環境值，未存取使用者資料。
- `npm run test:integration`：命令通過，但因本機沒有 `TEST_DATABASE_URL`，2 個檔案、11 項測試全部跳過；這不代表資料庫 migration 已驗證。

## v1 資料限制

- 舊 `account_snapshots` 只有數量、單價、匯率與 TWD 估值，無法可靠推回當時成本、已實現損益與帳戶狀態。
- v1 migration 新增 nullable 歷史欄位；舊列維持 `null`，畫面必須顯示資料缺口，禁止改用今天價格或目前成本補值。
- 帳戶狀態歷程自 migration 套用後才可精確追蹤；既有帳戶只記錄 migration 當下基線。
- 舊交易的手續費與稅費沒有結構化欄位，歸因時只能列入未解釋差額，不能假裝為已知費用。
- 本機未連接 Supabase；migration 需在可拋棄的測試資料庫執行整合測試後，才可考慮套用到正式環境。

## v1 設計邊界

- 基準幣別維持 TWD，日期邊界使用 `Asia/Taipei`。
- XIRR、TWR、已實現／未實現損益與現金流符號沿用既有定義。
- 決策情境快照建立後不可修改；檢討內容另表保存。
- 歷史回放只使用指定日期或之前的資料，並標示 carry-forward 與缺口。
- 情境模擬只改變試算資料，不寫回帳戶、交易或快照。
