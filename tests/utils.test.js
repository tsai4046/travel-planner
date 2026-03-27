/**
 * tests/utils.test.js
 * 測試 js/utils.js — escapeHTML, showToast, STORAGE_KEY
 */

// rendering.js 裡的 window.escapeHTML 在 jsdom 環境需要先設定
// 直接 require utils 即可讓 window.escapeHTML 被賦值
const { escapeHTML, showToast, STORAGE_KEY } = require('../js/utils.js');

// ─────────────────────────────────────────
// escapeHTML
// ─────────────────────────────────────────
describe('escapeHTML', () => {
  test('跳脫 < 和 >', () => {
    expect(escapeHTML('<script>')).toBe('&lt;script&gt;');
    expect(escapeHTML('</div>')).toBe('&lt;/div&gt;');
  });

  test('跳脫雙引號', () => {
    expect(escapeHTML('"hello"')).toBe('&quot;hello&quot;');
  });

  test('跳脫單引號', () => {
    expect(escapeHTML("it's a test")).toBe("it&#39;s a test");
  });

  test('跳脫 &', () => {
    expect(escapeHTML('Tom & Jerry')).toBe('Tom &amp; Jerry');
  });

  test('完整 XSS 攻擊字串', () => {
    expect(escapeHTML('<img src="x" onerror=\'alert(1)\'>')).toBe(
      '&lt;img src=&quot;x&quot; onerror=&#39;alert(1)&#39;&gt;'
    );
  });

  test('非字串類型原樣回傳', () => {
    expect(escapeHTML(42)).toBe(42);
    expect(escapeHTML(null)).toBe(null);
    expect(escapeHTML(undefined)).toBe(undefined);
    expect(escapeHTML(true)).toBe(true);
  });

  test('一般文字不變', () => {
    expect(escapeHTML('Hello, World!')).toBe('Hello, World!');
    expect(escapeHTML('')).toBe('');
  });
});

// ─────────────────────────────────────────
// STORAGE_KEY
// ─────────────────────────────────────────
describe('STORAGE_KEY', () => {
  test('固定為 travel_planner_trips', () => {
    expect(STORAGE_KEY).toBe('travel_planner_trips');
  });
});

// ─────────────────────────────────────────
// showToast
// ─────────────────────────────────────────
describe('showToast', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="toast-container"></div>';
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('成功新增 toast 元素', () => {
    showToast('測試訊息');
    const container = document.getElementById('toast-container');
    expect(container.children.length).toBe(1);
    expect(container.children[0].textContent).toBe('測試訊息');
  });

  test('3 秒後自動移除', () => {
    showToast('自動消失');
    const container = document.getElementById('toast-container');
    expect(container.children.length).toBe(1);
    jest.advanceTimersByTime(3000);
    expect(container.children.length).toBe(0);
  });

  test('多個 toast 可同時存在', () => {
    showToast('第一則');
    showToast('第二則');
    const container = document.getElementById('toast-container');
    expect(container.children.length).toBe(2);
  });
});
