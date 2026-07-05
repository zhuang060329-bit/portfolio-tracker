# 測試規則

## 驗收優先級

改動後必須依序通過：

1. `npx tsc --noEmit`（型別，0 error）
2. `npx vitest run`（67 tests 全過）
3. `NEXT_TELEMETRY_DISABLED=1 npx next build`（build 無錯）

三者缺一不可 push。

## 財務計算保護

`xirr.ts`、`metrics.ts`、`whatif.ts` 是核心計算，受到單元測試保護：

- 若修改上述檔案，必須跑對應測試並確認數值不變
- XIRR 精度或演算法若有調整，必須說明原因與預期影響
- 禁止刪除或跳過現有測試來讓數字「通過」
- 若有測試邏輯過時，先回報再確認修改，不自行刪除

## 回歸要求

任何改動若影響報價 / 匯率 / 損益計算路徑，commit message 必須說明對哪些計算邏輯有潛在影響。
