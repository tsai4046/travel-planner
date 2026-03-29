/**
 * tests/trips.test.js
 * 測試 js/auth.js — copyTrip, deleteTrip
 *
 * 由於 auth.js 依賴 Supabase 全域、DOM 元素，這裡在 require 前先完整設定環境。
 * copyTrip / deleteTrip 是設定在 window 上的 async 函式。
 */

// ═══════════════════════════════════════
// Supabase 全域 mock（auth.js 在 module 初始化時即呼叫）
// ═══════════════════════════════════════
const mockChain = {};
['upsert', 'delete', 'insert', 'eq', 'select', 'order', 'single'].forEach(fn => {
  mockChain[fn] = jest.fn().mockReturnValue(mockChain);
});
// 需要 await 的終端方法：回傳已解析的 Promise
mockChain.upsert.mockResolvedValue({ error: null });
mockChain.order.mockResolvedValue({ data: [], error: null });
mockChain.single.mockResolvedValue({ data: null, error: null });

const mockGetSession      = jest.fn().mockResolvedValue({ data: { session: null } });
const mockOnAuthChange    = jest.fn();
const mockSupabaseClient  = {
  auth: { getSession: mockGetSession, onAuthStateChange: mockOnAuthChange },
  from: jest.fn().mockReturnValue(mockChain),
};

global.supabase = { createClient: jest.fn().mockReturnValue(mockSupabaseClient) };

// ═══════════════════════════════════════
// 最小 DOM（auth.js 初始化時存取）
// ═══════════════════════════════════════
document.body.innerHTML = `
  <div id="trip-selector"></div>
  <div id="trip-cards-container"></div>
  <div id="auth-bar"></div>
  <div id="login-btn"></div>
  <div id="user-area" style="display:none"></div>
  <div id="user-name"></div>
  <img id="user-avatar" />
  <div id="sync-badge" style="display:none"></div>
  <div id="toast-container"></div>
  <input type="radio" name="share-perm" value="view" checked>
  <span class="share-perm-btn" data-val="view"></span>
`;

// ═══════════════════════════════════════
// 必要全域（auth.js 透過全域取得，非 import）
// ═══════════════════════════════════════
global.STORAGE_KEY  = 'travel_planner_trips';
global.trips        = [];
global.currentTrip  = null;
global.renderHome   = jest.fn();
global.showToast    = jest.fn();
window.showTrip     = jest.fn();
window.confirm      = jest.fn().mockReturnValue(true);

// ═══════════════════════════════════════
// 載入模組
// ═══════════════════════════════════════
require('../js/utils.js');
const authModule = require('../js/auth.js');

// ═══════════════════════════════════════
// 測試資料
// ═══════════════════════════════════════
const SAMPLE_TRIP = {
  id: 'trip-001',
  title: '日本東京',
  year: '2026',
  country: '日本',
  dates: '3/1~3/5',
  coverEmoji: '🗼',
  days: [],
  flights: { outbound: {}, inbound: {} },
  tickets: [],
};

// ═══════════════════════════════════════
// 每次測試前重設狀態
// ═══════════════════════════════════════
beforeEach(() => {
  global.trips       = [JSON.parse(JSON.stringify(SAMPLE_TRIP))];
  global.currentTrip = null;
  localStorage.clear();
  jest.clearAllMocks();
  authModule._setCurrentUser(null);
  window.confirm = jest.fn().mockReturnValue(true);
  // upsert 預設成功
  mockChain.upsert.mockResolvedValue({ error: null });
});

// ═══════════════════════════════════════
// copyTrip
// ═══════════════════════════════════════
describe('copyTrip', () => {
  test('找不到 id 時不做任何事（trips 不變）', async () => {
    await window.copyTrip('trip-not-exist');
    expect(global.trips.length).toBe(1);
    expect(global.renderHome).not.toHaveBeenCalled();
  });

  test('副本的 id 與原行程不同且符合 trip-<timestamp> 格式', async () => {
    await window.copyTrip('trip-001');
    expect(global.trips.length).toBe(2);
    expect(global.trips[1].id).not.toBe('trip-001');
    expect(global.trips[1].id).toMatch(/^trip-\d+$/);
  });

  test('副本標題在原標題後加上「（副本）」', async () => {
    await window.copyTrip('trip-001');
    expect(global.trips[1].title).toBe('日本東京（副本）');
  });

  test('副本為深複製（修改副本不影響原行程）', async () => {
    await window.copyTrip('trip-001');
    global.trips[1].title = '改標題';
    expect(global.trips[0].title).toBe('日本東京');
  });

  test('副本寫入 localStorage', async () => {
    await window.copyTrip('trip-001');
    const stored = JSON.parse(localStorage.getItem('travel_planner_trips') || '[]');
    expect(stored.length).toBe(1);
    expect(stored[0].title).toBe('日本東京（副本）');
  });

  test('呼叫 renderHome() 更新畫面', async () => {
    await window.copyTrip('trip-001');
    expect(global.renderHome).toHaveBeenCalled();
  });

  test('未登入時顯示「行程已複製」success toast', async () => {
    await window.copyTrip('trip-001');
    expect(global.showToast).toHaveBeenCalledWith(
      expect.stringContaining('行程已複製'),
      'success'
    );
  });

  test('已登入時呼叫 saveToCloud（upsert）並顯示雲端同步 toast', async () => {
    authModule._setCurrentUser({ id: 'user-123' });
    await window.copyTrip('trip-001');
    expect(mockChain.upsert).toHaveBeenCalled();
    expect(global.showToast).toHaveBeenCalledWith(
      expect.stringContaining('同步至雲端'),
      'success'
    );
  });

  test('已登入但雲端同步失敗時顯示 warn toast', async () => {
    authModule._setCurrentUser({ id: 'user-123' });
    mockChain.upsert.mockResolvedValueOnce({ error: { message: 'DB 錯誤' } });
    await window.copyTrip('trip-001');
    expect(global.showToast).toHaveBeenCalledWith(
      expect.stringContaining('雲端同步失敗'),
      'warn'
    );
  });
});

// ═══════════════════════════════════════
// deleteTrip
// ═══════════════════════════════════════
describe('deleteTrip', () => {
  beforeEach(() => {
    // 放一筆到 localStorage，測試刪除後是否清除
    localStorage.setItem('travel_planner_trips', JSON.stringify([SAMPLE_TRIP]));
  });

  test('找不到 id 時不做任何事', async () => {
    await window.deleteTrip('trip-not-exist');
    expect(global.trips.length).toBe(1);
    expect(window.confirm).not.toHaveBeenCalled();
  });

  test('confirm 回傳 false → 不刪除', async () => {
    window.confirm = jest.fn().mockReturnValue(false);
    await window.deleteTrip('trip-001');
    expect(global.trips.length).toBe(1);
  });

  test('confirm 對話框包含行程名稱', async () => {
    await window.deleteTrip('trip-001');
    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringContaining('日本東京')
    );
  });

  test('從 trips 陣列移除', async () => {
    await window.deleteTrip('trip-001');
    expect(global.trips.length).toBe(0);
    expect(global.trips.find(t => t.id === 'trip-001')).toBeUndefined();
  });

  test('從 localStorage 移除', async () => {
    await window.deleteTrip('trip-001');
    const stored = JSON.parse(localStorage.getItem('travel_planner_trips') || '[]');
    expect(stored.length).toBe(0);
  });

  test('刪除目前瀏覽的行程時 currentTrip 設為 null', async () => {
    global.currentTrip = { id: 'trip-001' };
    await window.deleteTrip('trip-001');
    expect(global.currentTrip).toBeNull();
  });

  test('刪除非目前行程時 currentTrip 保持不變', async () => {
    global.currentTrip = { id: 'trip-other' };
    await window.deleteTrip('trip-001');
    expect(global.currentTrip).toEqual({ id: 'trip-other' });
  });

  test('呼叫 renderHome() 更新畫面', async () => {
    await window.deleteTrip('trip-001');
    expect(global.renderHome).toHaveBeenCalled();
  });

  test('未登入時顯示「行程已刪除」success toast', async () => {
    await window.deleteTrip('trip-001');
    expect(global.showToast).toHaveBeenCalledWith('✅ 行程已刪除', 'success');
  });

  test('已登入時呼叫 deleteFromCloud（eq with trip_key）', async () => {
    authModule._setCurrentUser({ id: 'user-123' });
    await window.deleteTrip('trip-001');
    expect(mockChain.eq).toHaveBeenCalledWith('trip_key', 'trip-001');
    expect(global.showToast).toHaveBeenCalledWith('✅ 行程已刪除', 'success');
  });
});
