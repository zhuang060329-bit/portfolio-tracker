# 設計規則

## 定位

StackWorth 是工具型 UI，核心指標是資料可讀性，不是視覺衝擊。

## 設計優先級

數字可讀性 > 資訊密度 > 視覺效果

禁止為了「比較漂亮」犧牲：
- 表格數字對齊
- 財務數值的字重與對比
- 圖表的資訊密度

## 現有設計系統

- 沿用現有 Motion + React Bits 方案
- 禁止引入 GSAP 或 Lenis（那是 movie-app 的動畫工具，不適用工具型 UI）
- CSS 變數系統（`globals.css`）維持現有架構，深色模式靠 `[data-theme="dark"]` 自動翻轉
- 顏色慣例：賺綠虧紅（西方慣例），不改

## 禁止

- 禁止套 movie-app 的 cinematic GSAP / Lenis 風格到這個專案
- 禁止引入新的 UI library，除非另行確認
- 禁止套通用 SaaS 設計（紫藍漸層、glassmorphism、置中 hero）
- 圖表以 Recharts（已整合）為主，不引入其他圖表庫
- 禁止硬編碼顏色，統一用 CSS 變數
