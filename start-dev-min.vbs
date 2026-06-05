' 雙擊此檔啟動 portfolio-tracker dev server。
' 啟動器本身無視窗（vbs 透過 wscript 跑、不開黑窗），
' 伺服器 cmd 視窗會以「最小化」狀態出現在工作列，不會彈出搶焦點。
' 工作列點開那個 cmd 就能看 dev server 輸出；按 X 關掉就停止伺服器。

Option Explicit

Dim sh, fso, scriptDir, cmd
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' 取得本 .vbs 所在的資料夾，當作 npm 的工作目錄（搬家也不會壞）
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

' cmd /k 讓視窗在 npm dev 結束前不要關，這樣使用者隨時可叫出來看 log
' 標題加 "Portfolio dev server" 方便工作列辨識
cmd = "cmd /k ""title Portfolio dev server && cd /d """ & scriptDir _
    & """ && set NEXT_TELEMETRY_DISABLED=1 && npm run dev"""

' Run(command, windowStyle, waitOnReturn)
' windowStyle = 7 → 最小化、且不搶焦點（顯示在工作列）
' waitOnReturn = False → 啟動後立刻結束 vbs 本身
sh.Run cmd, 7, False
