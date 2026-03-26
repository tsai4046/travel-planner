# Google Maps 座標精準搜尋 & 系統全面資安計畫

此計畫致力於解決搜尋精確度不佳的問題，透過 Supabase Edge Functions 安全地橋接 Google Maps API。此外，**在您提出的資安考量下，我們將為整個前端與後端架構注入多層級的安全防護機制**，徹底防範 SQL Injection、XSS（跨站腳本攻擊）以及 API 惡意盜刷。

## 🎯 核心目標
1. 建立不可見於前端的 Supabase Edge Function，並掛載身份驗證以防濫用。
2. 串接世界上最精確的 **Google Maps Geocoding API**。
3. 把簡陋的原生 `prompt()` 升級為美觀的原生對話框 (Custom Modal)。
4. 首度於全系統導入 **HTML 防 XSS 渲染機制** 與 **資料庫嚴格政策 (RLS)**。

---

## 🛡️ 資安防護層級設計 (Security Layers)

### 1. 後端與資料庫防護 (Supabase DB Layer)
- **防範 SQL Injection（資料庫注入）**: 
  Supabase 預設使用 PostgREST API（底層為參數化查詢 Prepared Statements），這表示所有寫入 JSONB (`data: trip`) 的資料都不會被當作 SQL 指令執行。因此，傳統的 SQL 注入攻擊對這套架構是**無效**的。
- **行級安全性 (Row Level Security, RLS)**:
  所有的 `trips` 資料表都強制開啟 RLS 政策。存取規則為 `auth.uid() = owner_id`。這保證即使有人在終端機拿到你的資料庫端點，只要他無法生出合法的帳號 Token，就絕對無法讀取、修改或刪除別人的行程。

### 2. API 濫用防護 (Edge Function Layer)
- **阻擋匿名盜刷的防黑心機制**:
  Edge Function (`supabase/functions/geocode/index.ts`) 不能是隨便誰打網址都能通的公開 API。
  在處理邏輯中，我們將會**解讀從前端發過來的 JWT Header (Authorization bearer token)**。這表示「**只有登入系統本身的會員**」才有資格呼叫這支函式去問 Google Maps，將被盜用導致 Google 帳單爆發的機率降到零。
- **輸入驗證 (Input Sanitization)**:
  傳入的 `query` 字串強制限制長度（如最大 100 字元），並且剝除所有特殊符號（只保留文字、數字、加號），避免對後端造成無法預期的錯誤。

### 3. 前端網頁防護 (Frontend XSS Layer)
- **目前的隱患**:
  目前的 [travel-planner.html](file:///g:/%E6%88%91%E7%9A%84%E9%9B%B2%E7%AB%AF%E7%A1%AC%E7%A2%9F/HTML/travel_plan/travel-planner.html) 與 [editor.js](file:///g:/%E6%88%91%E7%9A%84%E9%9B%B2%E7%AB%AF%E7%A1%AC%E7%A2%9F/HTML/travel_plan/js/editor.js) 使用大量 `innerHTML = ` 來渲染畫面（例如：`<div class="timeline">${day.title}</div>`）。這表示如果惡意使用者在標題輸入 `<script>盜取你的 Cookie</script>`，這段程式碼將在所有看到這個行程的人的瀏覽器上默默執行，造成嚴重的 **儲存型 XSS 攻擊**。
- **針對性解決方案**:
  在全域宣告一個 `escapeHTML()` 消毒工具函式。我們會在實作時，對所有的文字輸出（`tl.title`, `day.subtitle`, `accommodation.address` 等）套上 `escapeHTML()`，讓 `< >` 乖乖變成 `&lt;` 與 `&gt;`，從此免疫 XSS。

---

## 🏗️ 實作改動清單 (Proposed Changes)

### 1. `supabase/functions/geocode/index.ts` (後端函式)
1. 建立 Edge Function 骨架。
2. 從 Request Header 擷取和驗證 Supabase User Token。
3. 安全檢查與 URL 構建。
4. 回傳帶有 CORS 標頭與精確經緯度的 JSON。

### 2. [travel-planner.html](file:///g:/%E6%88%91%E7%9A%84%E9%9B%B2%E7%AB%AF%E7%A1%AC%E7%A2%9F/HTML/travel_plan/travel-planner.html) (前端改動)
- 在最上方實作通用的防 XSS 字串消毒函式：`window.escapeHTML`。
- 新增 `<div id="location-modal" class="modal">` 結構（UI 層的改善）。
- 檢視全檔使用到 `innerHTML` 變數拼接的地方，全部套上 `${escapeHTML(variable)}`。

### 3. [js/editor.js](file:///g:/%E6%88%91%E7%9A%84%E9%9B%B2%E7%AB%AF%E7%A1%AC%E7%A2%9F/HTML/travel_plan/js/editor.js) (腳本與邏輯)
- [fetchCoordinates](file:///g:/%E6%88%91%E7%9A%84%E9%9B%B2%E7%AB%AF%E7%A1%AC%E7%A2%9F/HTML/travel_plan/js/editor.js#271-343) 流程修改：改為透過 `Supabase.functions.invoke('geocode', ...)` 發送夾帶驗證 Token 的 POST 請求。
- 把 [saveFormEditor](file:///g:/%E6%88%91%E7%9A%84%E9%9B%B2%E7%AB%AF%E7%A1%AC%E7%A2%9F/HTML/travel_plan/js/editor.js#344-416) 中原先直接存入的資料，確定不會包含長度過度異常的字串。

---

## 🚦 驗證計畫 (Verification Plan)

**手動驗證流程：**
1. **注入測試**：故意在「標題」中輸入 `<img src=x onerror=alert("被入侵了")>` 並儲存行程，觀察頁面是否會彈出除錯警告窗（不會，因為 XSS 防護已啟動）。
2. **API 阻擋測試（未登入）**：在未登入或私密無痕模式下執行 `Supabase.functions.invoke()`，應得到 `401 Unauthorized` 或被拒絕存取，確保你的 Google 額度不會被吃掉。
3. **UI 與功能測試**：登入完成後正常使用自訂對話框查詢地址，並順利顯示在 Leaflet 地圖上。
