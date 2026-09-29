# Gmail 免費串接（Google Apps Script）

這個橋接器讓競賽評審管理平台使用你自己的 Gmail：
- 建立真正的 Gmail 草稿
- 立即寄出
- 排程寄出
- 取消排程（可保留草稿）
- 查詢 Apps Script 當日剩餘寄信額度

## 設定步驟
1. 前往 https://script.google.com/ 建立「新專案」。
2. 把 `gmail-appscript-bridge.gs` 全部內容貼入 `Code.gs`。
3. 到「專案設定」→「指令碼屬性」，新增：
   - 名稱：`BRIDGE_SECRET`
   - 值：使用競賽系統郵件中心產生的連線密鑰。
4. 在 Apps Script 編輯器執行一次 `authorizeGmailBridge()`，依畫面完成 Gmail 權限授權。
5. 「部署」→「新增部署作業」→ 類型選「網頁應用程式」：
   - 執行身分：我／部署者
   - 誰可以存取：需允許未登入使用者存取。一般個人帳號通常顯示「任何人」；不可只限自己、網域內或必須登入 Google 的使用者。
6. 完成部署後，複製以 `/exec` 結尾的正式 Web App 網址。不要使用 `/dev` 測試網址，也不要只貼 Deployment ID。
7. 建議先用無痕／未登入 Google 的瀏覽器開啟 `/exec` 網址。正常時應看到類似 `{"ok":true,"service":"Competition Gmail Bridge","message":"Use POST."}` 的 JSON；若看到 404 或 Google 登入頁，請先修正部署與存取權限。
8. 回到競賽系統 → 郵件中心 → Gmail 免費串接，貼上 Web App 網址及同一組連線密鑰。
9. 按「儲存並測試連線」。

> 若你的 Google Workspace 管理員禁止「任何人」存取 Apps Script Web App，這種免費 bridge 方式會被組織政策擋住；此時需改用 OAuth 型 Gmail API 串接。

## 排程方式
系統會先建立真正的 Gmail 草稿，再由 Apps Script 的單一時間觸發器於指定時間送出。
大量排程不會為每封信建立一個 trigger，因此不會快速碰到 Apps Script 的 trigger 數量限制。

## 免費額度
Apps Script 的寄信每日收件人額度由 Google 決定。系統會讀取剩餘額度；額度不足時，已排程的草稿會保留，等待之後繼續處理。
