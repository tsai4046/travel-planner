# 日本 8 日行程規劃 —— 拖曳編輯功能實作計畫

## 📋 概述

為現有的靜態行程網站（`index.html`）加入「同一天內時間軸項目拖曳排序」功能，允許使用者重新調整各天的景點訪問順序。拖曳操作後需手動按下儲存按鈕才會提交資料。

---

## 🎯 功能需求

### 核心功能
- ✅ 使用者可拖曳同一天內的時間軸項目（`<li>` 元素）
- ✅ 拖曳動畫順滑、視覺回饋清晰
- ✅ 拖曳後的順序臨時存放在前端狀態
- ✅ 需手動按「儲存」按鈕才提交資料到後端
- ✅ 若未按儲存，刷新頁面應恢復原始順序

### 邊界條件
- ❌ 禁止跨日期拖曳（Day 1 的項目不能拖到 Day 2）
- ❌ 禁止拖曳至其他 Day section 的時間軸
- ✅ 支援撤銷/重置至原始狀態
- ✅ 支援響應式設計（行動版也能拖曳）

---

## 🛠️ 技術棧與選型

### 前端框架
| 技術 | 用途 | 說明 |
|------|------|------|
| **SortableJS** | 拖曳排序庫 | CDN 引入，功能完整、動畫順滑、易整合 |
| **Vanilla JS** | 狀態管理 | 由於現有頁面已是純 HTML/JS，無需引入 React/Vue |
| **Tailwind CSS** | 樣式 | 利用現有 Tailwind 類別實作動態樣式 |

### 後端
| 端點 | 方法 | 用途 |
|------|------|------|
| `/api/itinerary/:dayId/reorder` | `POST` | 提交重新排序後的時間軸順序 |
| `/api/itinerary/:dayId/reset` | `POST` | 重置至原始順序 |

---

## 📐 架構設計

### 1. 前端狀態結構

```javascript
// 在全局作用域定義拖曳狀態
const DragState = {
  // 記錄原始順序（用於重置）
  original: {
    day1: [
      { id: 'item-1-1', time: '06:00', title: '抵達中部國際機場' },
      { id: 'item-1-2', time: '10:30', title: '名鐵特急進市區' },
      // ... 其他項目
    ],
    day2: [ /* ... */ ],
    // ... 其他日期
  },

  // 記錄當前順序（可能被編輯）
  current: {
    day1: [ /* 同上結構 */ ],
    day2: [ /* ... */ ],
  },

  // 記錄編輯狀態
  isModified: false,  // 是否有未儲存的更改
  modifiedDays: new Set(),  // 哪些天被修改過
};
```

### 2. DOM 結構調整

**現狀：**
```html
<section id="day1" class="day-card ...">
  <div class="...">Day 1 標頭</div>
  <div class="p-4 md:p-6 ...">
    <ul class="space-y-4 text-sm">
      <li>項目 1</li>
      <li>項目 2</li>
      <!-- ... -->
    </ul>
  </div>
</section>
```

**目標調整：**
```html
<section id="day1" class="day-card ...">
  <div class="...">
    Day 1 標頭
    <!-- 新增：編輯模式指示器 -->
    <span class="edit-mode-badge hidden">編輯中</span>
  </div>
  <div class="p-4 md:p-6 ...">
    <!-- 新增：sortable 容器識別符 -->
    <ul class="space-y-4 text-sm sortable-timeline" data-day-id="day1">
      <!-- 每個 <li> 需要唯一 ID -->
      <li class="sortable-item" id="item-day1-1">項目 1</li>
      <li class="sortable-item" id="item-day1-2">項目 2</li>
    </ul>
  </div>
  <!-- 新增：儲存/撤銷按鈕容器 -->
  <div class="action-buttons hidden">
    <button class="save-btn">💾 儲存</button>
    <button class="reset-btn">↶ 撤銷</button>
  </div>
</section>
```

---

## 🔧 實作步驟

### Phase 1: 準備工作（30 分鐘）

#### 1.1 引入 SortableJS

在 `<head>` 中新增：
```html
<script src="https://cdn.jsdelivr.net/npm/sortablejs@latest/Sortable.min.js"></script>
```

#### 1.2 為時間軸項目加入 ID

遍歷所有日期的 `<li>` 元素，確保每個都有唯一 ID：
```
id="item-{dayId}-{index}"
例：id="item-day1-1", id="item-day2-3"
```

**位置：** `<ul class="space-y-4 text-sm">` 中的每個 `<li>`

#### 1.3 加入 CSS 類別

在現有 `<style>` 區塊新增：
```css
/* 拖曳時的視覺效果 */
.sortable-item {
  cursor: grab;
  transition: background-color 0.2s ease, box-shadow 0.2s ease;
}

.sortable-item:active {
  cursor: grabbing;
}

.sortable-item.sortable-ghost {
  opacity: 0.5;
  background-color: #fca5a5;  /* 淡紅色預留位置 */
}

.sortable-item.sortable-chosen {
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
  transform: scale(1.02);
}

/* 編輯模式指示 */
.edit-mode-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  background-color: #fef08a;
  color: #92400e;
  border-radius: 0.5rem;
  font-size: 0.75rem;
  font-weight: bold;
  margin-left: 0.5rem;
}

/* 儲存/撤銷按鈕 */
.action-buttons {
  padding: 1rem;
  border-top: 1px solid #e2e8f0;
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.action-buttons.hidden {
  display: none;
}

.action-buttons button {
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  font-weight: bold;
  font-size: 0.875rem;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
}

.save-btn {
  background-color: #10b981;  /* 翠綠 */
  color: white;
}

.save-btn:hover {
  background-color: #059669;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.reset-btn {
  background-color: #6b7280;  /* 灰色 */
  color: white;
}

.reset-btn:hover {
  background-color: #4b5563;
}
```

---

### Phase 2: 初始化拖曳系統（1 小時）

#### 2.1 定義初始化函數

在 `<script>` 區塊新增：

```javascript
/**
 * 初始化拖曳系統
 * - 掃描所有 Day section
 * - 擷取原始順序並儲存至 DragState.original
 * - 為每個時間軸設置 Sortable
 */
function initDragSystem() {
  // 取得所有日期 section
  const daySections = document.querySelectorAll('[id^="day"]');

  daySections.forEach(section => {
    const dayId = section.id;  // "day1", "day2", ...
    const timeline = section.querySelector('.sortable-timeline');

    if (!timeline) return;

    // 第 1 步：擷取原始順序
    const items = Array.from(timeline.querySelectorAll('.sortable-item'));
    DragState.original[dayId] = items.map((li, index) => ({
      id: li.id || `item-${dayId}-${index}`,
      time: li.querySelector('span.font-mono')?.textContent.trim() || '',
      title: li.querySelector('b')?.textContent.trim() || '',
      html: li.innerHTML,  // 完整 HTML 備份（用於重置）
    }));

    DragState.current[dayId] = JSON.parse(JSON.stringify(DragState.original[dayId]));

    // 第 2 步：初始化 Sortable
    new Sortable(timeline, {
      group: `timeline-${dayId}`,  // 禁止跨日期拖曳
      animation: 150,
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      dragClass: 'sortable-drag',
      handle: '.sortable-item',  // 整個 <li> 都可拖曳
      onEnd: (event) => handleDragEnd(event, dayId),
    });
  });
}

/**
 * 處理拖曳結束事件
 */
function handleDragEnd(event, dayId) {
  // 更新 current 狀態
  const timeline = document.querySelector(`#${dayId} .sortable-timeline`);
  const items = Array.from(timeline.querySelectorAll('.sortable-item'));

  DragState.current[dayId] = items.map((li, index) => ({
    id: li.id,
    time: li.querySelector('span.font-mono')?.textContent.trim() || '',
    title: li.querySelector('b')?.textContent.trim() || '',
    html: li.innerHTML,
  }));

  // 檢查是否有變更
  checkIfModified();

  // 顯示儲存按鈕
  showActionButtons(dayId);
}

/**
 * 檢查是否有未儲存的變更
 */
function checkIfModified() {
  for (const dayId in DragState.original) {
    const original = DragState.original[dayId];
    const current = DragState.current[dayId];

    // 比較兩者順序是否相同
    const isModified = JSON.stringify(original.map(i => i.id)) !==
                       JSON.stringify(current.map(i => i.id));

    if (isModified) {
      DragState.isModified = true;
      DragState.modifiedDays.add(dayId);
      return;
    }
  }
  DragState.isModified = false;
}

/**
 * 顯示/隱藏儲存與撤銷按鈕
 */
function showActionButtons(dayId) {
  const section = document.getElementById(dayId);
  const actionButtons = section.querySelector('.action-buttons');
  const badge = section.querySelector('.edit-mode-badge');

  if (actionButtons && DragState.modifiedDays.has(dayId)) {
    actionButtons.classList.remove('hidden');
    if (badge) badge.classList.remove('hidden');
  }
}

/**
 * 隱藏儲存與撤銷按鈕
 */
function hideActionButtons(dayId) {
  const section = document.getElementById(dayId);
  const actionButtons = section.querySelector('.action-buttons');
  const badge = section.querySelector('.edit-mode-badge');

  if (actionButtons) {
    actionButtons.classList.add('hidden');
  }
  if (badge) badge.classList.add('hidden');
}
```

#### 2.2 在頁面載入時初始化

修改現有的 `DOMContentLoaded` 監聽器：

```javascript
window.addEventListener('DOMContentLoaded', () => {
  fetchFlightStatus();
  fetchWeatherData();
  scrollToToday();
  setupGoogleMapLinks();
  initDragSystem();  // 新增這行
});
```

---

### Phase 3: 儲存與撤銷邏輯（45 分鐘）

#### 3.1 儲存功能

```javascript
/**
 * 儲存拖曳後的順序至後端
 */
async function saveOrder(dayId) {
  const items = DragState.current[dayId];
  const payload = {
    dayId,
    order: items.map(item => item.id),
    timestamp: new Date().toISOString(),
  };

  try {
    const response = await fetch('/api/itinerary/reorder', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`API 錯誤: ${response.status}`);
    }

    const result = await response.json();
    
    // 更新原始狀態（表示已儲存）
    DragState.original[dayId] = JSON.parse(JSON.stringify(DragState.current[dayId]));
    
    // 移除該日期的修改標記
    DragState.modifiedDays.delete(dayId);
    
    // 隱藏按鈕
    hideActionButtons(dayId);
    
    // 顯示成功提示
    showNotification(`✅ Day ${dayId.replace('day', '')} 行程已儲存`, 'success');

  } catch (error) {
    console.error('儲存失敗:', error);
    showNotification('❌ 儲存失敗，請重試', 'error');
  }
}

/**
 * 撤銷拖曳，恢復至上次儲存的狀態
 */
function resetOrder(dayId) {
  const timeline = document.querySelector(`#${dayId} .sortable-timeline`);
  
  // 恢復 current 狀態
  DragState.current[dayId] = JSON.parse(JSON.stringify(DragState.original[dayId]));
  
  // 重新排序 DOM
  const items = Array.from(timeline.querySelectorAll('.sortable-item'));
  const orderedItems = DragState.original[dayId].map(originalItem => 
    items.find(li => li.id === originalItem.id)
  ).filter(Boolean);

  // 清空再重新插入（以恢復順序）
  timeline.innerHTML = '';
  orderedItems.forEach(item => {
    timeline.appendChild(item.cloneNode(true));
  });

  // 移除修改標記
  DragState.modifiedDays.delete(dayId);
  
  // 隱藏按鈕
  hideActionButtons(dayId);
  
  showNotification(`↶ Day ${dayId.replace('day', '')} 已復原', 'info');
}
```

#### 3.2 綁定按鈕事件

在初始化函數中新增：

```javascript
function initDragSystem() {
  // ... 既有的初始化代碼 ...

  // 新增：為每個 day section 的按鈕綁定事件
  daySections.forEach(section => {
    const dayId = section.id;
    const saveBtn = section.querySelector('.save-btn');
    const resetBtn = section.querySelector('.reset-btn');

    if (saveBtn) {
      saveBtn.addEventListener('click', () => saveOrder(dayId));
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm(`確定要復原 Day ${dayId.replace('day', '')} 的變更嗎？`)) {
          resetOrder(dayId);
        }
      });
    }
  });
}
```

---

### Phase 4: 用戶回饋與提示（30 分鐘）

#### 4.1 通知系統

```javascript
/**
 * 顯示通知訊息（Toast）
 */
function showNotification(message, type = 'info') {
  // 若 DOM 中不存在通知容器，則建立
  let container = document.getElementById('notification-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'notification-container';
    container.className = 'fixed bottom-4 right-4 space-y-2 z-50';
    document.body.appendChild(container);
  }

  // 建立通知元素
  const notification = document.createElement('div');
  notification.className = `px-4 py-3 rounded-lg text-white font-bold shadow-lg animate-pulse`;

  if (type === 'success') {
    notification.classList.add('bg-emerald-500');
  } else if (type === 'error') {
    notification.classList.add('bg-rose-500');
  } else {
    notification.classList.add('bg-blue-500');
  }

  notification.textContent = message;
  container.appendChild(notification);

  // 3 秒後移除
  setTimeout(() => {
    notification.remove();
  }, 3000);
}
```

#### 4.2 新增 CSS 動畫

在 `<style>` 中補充：

```css
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.notification-enter {
  animation: fadeInUp 0.3s ease-out;
}
```

---

### Phase 5: 後端 API 設計（1 小時）

#### 5.1 重新排序端點

**端點：** `POST /api/itinerary/reorder`

**請求體：**
```json
{
  "dayId": "day1",
  "order": ["item-day1-3", "item-day1-1", "item-day1-2"],
  "timestamp": "2026-03-25T10:30:00Z"
}
```

**回應（成功）：**
```json
{
  "success": true,
  "message": "Day 1 行程已重新排序",
  "dayId": "day1",
  "newOrder": ["item-day1-3", "item-day1-1", "item-day1-2"]
}
```

**回應（錯誤）：**
```json
{
  "success": false,
  "error": "Invalid day ID or order",
  "statusCode": 400
}
```

**後端實作邏輯：**
1. 驗證 `dayId` 是否有效（day1 ~ day8）
2. 驗證 `order` 陣列中的項目 ID 是否都存在
3. 驗證 `order` 長度與原始項目數相同（無遺漏/重複）
4. 從資料庫讀取該日期的行程項目
5. 根據 `order` 重新排列並更新資料庫
6. 返回新順序以供確認

#### 5.2 重置端點（可選）

**端點：** `POST /api/itinerary/{dayId}/reset`

**功能：** 從資料庫重新取得原始排序

---

## 📊 狀態流轉圖

```
┌─────────────────┐
│   初始狀態      │
│ (已載入行程)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  使用者拖曳項目  │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│  current 狀態更新       │
│ 顯示「編輯中」徽章      │
│ 顯示儲存/撤銷按鈕       │
└────────┬────────────────┘
         │
         ├─── 按下「撤銷」────┐
         │                   │
         ▼                   ▼
    ┌─────────────────────────┐
    │ 復原至 original 狀態    │
    │ 隱藏按鈕、清除徽章      │
    │ 顯示成功提示            │
    └─────────────────────────┘
         │
         │ 或 按下「儲存」
         │
         ▼
┌─────────────────────────┐
│  POST /api/reorder      │
│  (提交至後端)           │
└────────┬────────────────┘
         │
         ├─── 成功 ──────────┐
         │                   │
         ▼                   ▼
    ┌──────────────────────────────┐
    │ original = current           │
    │ 隱藏按鈕、清除徽章           │
    │ 顯示「已儲存」提示           │
    │ 返回初始狀態                 │
    └──────────────────────────────┘
         │
         └─── 失敗 ──────────┐
                             │
                             ▼
                    ┌──────────────────┐
                    │ 顯示錯誤提示     │
                    │ 保留編輯狀態     │
                    │ 允許重試         │
                    └──────────────────┘
```

---

## 🧪 測試計畫

### 單元測試

| 測試項目 | 預期結果 | 檢查點 |
|---------|---------|--------|
| 初始化時擷取原始順序 | DragState.original 正確填充 | 每個 day 有對應的項目陣列 |
| 拖曳後 current 狀態更新 | current 反映新順序 | 拖曳結束後 current === 新順序 |
| 按下撤銷後復原 | DOM 回到原始順序 | 視覺上順序正確 |
| 跨日期拖曳被阻止 | 無法將 Day 1 項目拖到 Day 2 | Sortable group 設置生效 |
| 儲存 API 調用 | 正確的 payload 被發送 | Network tab 顯示正確的請求體 |
| 刷新頁面後狀態 | 恢復至上次儲存的狀態 | 頁面重載後顯示儲存的順序（需後端配合） |

### 集成測試

| 場景 | 步驟 | 預期結果 |
|-----|------|---------|
| 完整拖曳流程 | 1. 拖曳項目 2. 看到按鈕 3. 按儲存 4. 刷新 | 新順序被保留 |
| 多日期編輯 | 1. 編輯 Day 1 2. 編輯 Day 3 3. Day 1 先存 4. Day 3 再存 | 兩個日期都正確儲存 |
| 誤操作復原 | 1. 拖曳 2. 按撤銷 3. 刷新 | 原始順序被保留 |
| 編輯狀態提示 | 1. 拖曳項目 2. 查看 UI | 徽章、按鈕、顏色變化正確 |

### 響應式測試

- 行動裝置（< 640px）：拖曳手勢是否順暢
- 平板（640px ~ 1024px）：按鈕排版是否合適
- 桌面（> 1024px）：整體佈局是否美觀

---

## 🚀 上線部署檢查清單

- [ ] SortableJS CDN 鏈接可用
- [ ] 所有時間軸項目都有唯一 ID
- [ ] CSS 樣式已加入，無 class 衝突
- [ ] 初始化函數在 DOMContentLoaded 時執行
- [ ] 後端 `/api/itinerary/reorder` 端點已實作
- [ ] 資料庫遷移已執行（若需新增欄位）
- [ ] 錯誤處理與日誌記錄已完善
- [ ] 瀏覽器相容性測試完成（Chrome, Firefox, Safari, Edge）
- [ ] 行動裝置測試完成
- [ ] 效能測試（確認無頓卡現象）
- [ ] 安全性檢查（CSRF token, 輸入驗證等）

---

## 📝 相關文件與參考

### SortableJS 官方文檔
- 主頁：https://sortablejs.github.io/Sortable/
- 配置選項：https://sortablejs.github.io/Sortable/#option

### 相關代碼片段位置

| 功能 | 檔案位置 | 行號範圍 |
|-----|---------|---------|
| DragState 定義 | `index.html` | `<script>` 區塊開頭 |
| initDragSystem 函數 | `index.html` | `<script>` 區塊中段 |
| saveOrder 函數 | `index.html` | `<script>` 區塊中段 |
| 事件綁定 | `index.html` | DOMContentLoaded 監聽器 |
| CSS 樣式 | `index.html` | `<style>` 區塊 |

---

## ⚠️ 已知限制與注意事項

### 當前限制
1. **無雲端同步**：若多個瀏覽器標籤同時編輯，只有最後儲存的會生效
   - 建議：未來可加入 WebSocket 即時更新

2. **無版本控制**：無法查看行程變更歷史
   - 建議：後端可額外儲存 audit log

3. **無批量操作**：一次只能編輯一天的順序
   - 建議：若未來需求可加入批量編輯模式

4. **無離線支持**：無法在網路不穩定時緩存變更
   - 建議：可使用 IndexedDB 本地快取

### 效能考量
- 若單天超過 20 個項目，拖曳動畫可能略顯遲滯
  - 解決：可在初始化時加入虛擬列表或分頁

---

## 📞 故障排查指南

### 問題：按鈕不顯示
**檢查清單：**
1. `checkIfModified()` 是否被正確調用
2. `DragState.modifiedDays` 是否包含該 dayId
3. CSS 類別 `.hidden` 是否有衝突

### 問題：拖曳無法跨日期（實際上想跨日期）
**檢查清單：**
1. Sortable group 設置是否意圖限制
2. 重新評估需求，調整 `group` 參數

### 問題：儲存後刷新頁面順序未改變
**檢查清單：**
1. 後端是否正確儲存資料到資料庫
2. 頁面重載時是否從資料庫讀取新順序
3. API response 中的 `newOrder` 是否被使用

---

## 🎓 學習資源與進階功能

### 進階擴展方向
1. **拖曳撤銷/重做**：加入 Undo/Redo 堆棧
2. **協作編輯**：多使用者同時編輯的衝突解決
3. **時間提醒**：自動調整景點間的交通時間
4. **行程最佳化**：根據地理位置建議最優路線
5. **離線模式**：使用 Service Worker 支持離線編輯

---

**文件版本：** v1.0  
**最後更新：** 2026-03-25  
**作者：** Claude AI Assistant
