/**
 * tests/rendering.test.js
 * 測試 js/rendering.js — renderHome, renderFlight, renderDay, renderTransport, toggleTransport
 *
 * 注意：showTrip / showHome 依賴全域 trips / currentTrip，
 * 屬於整合層行為，這裡只測試「回傳 HTML 字串」的純輸出函式。
 */

// rendering.js 內部使用 window.escapeHTML，需先載入 utils.js
require('../js/utils.js');
const { renderHome, renderFlight, renderDay, renderTransport, toggleTransport } = require('../js/rendering.js');

// ─────────────────────────────────────────
// renderFlight
// ─────────────────────────────────────────
describe('renderFlight', () => {
  const flight = {
    icon: 'fa-plane-arrival',
    label: '去程',
    route: 'TPE → NRT',
    detail: 'BR123 | 08:00',
  };

  test('包含 label、route、detail', () => {
    const html = renderFlight(flight, 'status-out');
    expect(html).toContain('去程');
    expect(html).toContain('TPE → NRT');
    expect(html).toContain('BR123 | 08:00');
  });

  test('包含指定 statusId', () => {
    const html = renderFlight(flight, 'status-out');
    expect(html).toContain('id="status-out"');
  });

  test('包含 Font Awesome icon class', () => {
    const html = renderFlight(flight, 'status-out');
    expect(html).toContain('fa-plane-arrival');
  });

  test('不同 statusId 正確套用', () => {
    const html = renderFlight(flight, 'status-in');
    expect(html).toContain('id="status-in"');
    expect(html).not.toContain('id="status-out"');
  });
});

// ─────────────────────────────────────────
// renderDay
// ─────────────────────────────────────────
describe('renderDay', () => {
  const baseDay = {
    id: 'day1',
    day: 1,
    date: '4/1 星期二',
    subtitle: '抵達東京',
    weather: { lat: 35.6895, lon: 139.6917, date: '2026-04-01', label: '東京' },
    timeline: [
      { time: '09:00', title: '淺草寺', desc: '參觀雷門' },
      { time: '12:00', title: '拉麵午餐', desc: '' },
    ],
    food: [
      { name: '一蘭拉麵', category: '拉麵' },
    ],
    accommodation: {
      name: '東橫INN',
      address: '東京都新宿區...',
      mapQuery: '東橫INN 新宿',
    },
  };

  test('包含 day id 作為 section id', () => {
    const html = renderDay(baseDay);
    expect(html).toContain('id="day1"');
  });

  test('包含日期和副標題', () => {
    const html = renderDay(baseDay);
    expect(html).toContain('4/1 星期二');
    expect(html).toContain('抵達東京');
  });

  test('包含時間軸項目', () => {
    const html = renderDay(baseDay);
    expect(html).toContain('09:00');
    expect(html).toContain('淺草寺');
    expect(html).toContain('參觀雷門');
  });

  test('包含餐廳備選', () => {
    const html = renderDay(baseDay);
    expect(html).toContain('一蘭拉麵');
    expect(html).toContain('拉麵');
  });

  test('包含住宿資訊', () => {
    const html = renderDay(baseDay);
    expect(html).toContain('東橫INN');
    expect(html).toContain('東京都新宿區');
  });

  test('XSS 防護：惡意標題被跳脫', () => {
    const maliciousDay = {
      ...baseDay,
      id: 'day2',
      timeline: [{ time: '10:00', title: '<script>alert(1)</script>', desc: '' }],
      food: [],
      accommodation: null,
    };
    const html = renderDay(maliciousDay);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  test('無住宿時不渲染 accom-card', () => {
    const noAccom = { ...baseDay, id: 'day3', accommodation: null };
    const html = renderDay(noAccom);
    expect(html).not.toContain('accom-card');
  });

  test('無餐廳時不渲染 food-section', () => {
    const noFood = { ...baseDay, id: 'day4', food: [] };
    const html = renderDay(noFood);
    expect(html).not.toContain('food-section');
  });

  test('timeline 項目不渲染地圖佔位符（地圖功能已移除）', () => {
    const withCoord = {
      ...baseDay,
      id: 'day5',
      timeline: [{ time: '09:00', title: '淺草寺', desc: '', lat: 35.7148, lon: 139.7967 }],
    };
    const html = renderDay(withCoord);
    expect(html).not.toContain('id="map-day5"');
  });

  test('Day chip 數字不足兩位補零', () => {
    const html = renderDay(baseDay);
    expect(html).toContain('01'); // day: 1 → '01'
  });
});

// ─────────────────────────────────────────
// renderTransport
// ─────────────────────────────────────────
describe('renderTransport', () => {
  const transport = {
    summary: '搭乘山手線',
    tags: ['JR Pass 可用', '約 30 分鐘'],
    details: '從新宿站 → 澀谷站，月台 1',
  };

  test('包含 summary 文字', () => {
    const html = renderTransport(transport);
    expect(html).toContain('搭乘山手線');
  });

  test('包含所有 tags', () => {
    const html = renderTransport(transport);
    expect(html).toContain('JR Pass 可用');
    expect(html).toContain('約 30 分鐘');
  });

  test('包含詳細說明', () => {
    const html = renderTransport(transport);
    expect(html).toContain('從新宿站 → 澀谷站');
  });

  test('包含 onclick 展開/收合', () => {
    const html = renderTransport(transport);
    expect(html).toContain('toggleTransport');
  });

  test('無 tags 時不渲染 transport-tag', () => {
    const noTags = { ...transport, tags: [] };
    const html = renderTransport(noTags);
    expect(html).not.toContain('transport-tag');
  });

  test('XSS 防護：summary 被跳脫', () => {
    const xss = { ...transport, summary: '<b>inject</b>' };
    const html = renderTransport(xss);
    expect(html).not.toContain('<b>inject</b>');
    expect(html).toContain('&lt;b&gt;');
  });
});

// ─────────────────────────────────────────
// toggleTransport — DOM 互動
// ─────────────────────────────────────────
describe('toggleTransport', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div class="transport-summary" id="ts-abc"></div>
      <div class="transport-details" id="td-abc"></div>
    `;
  });

  test('第一次呼叫加上 open class', () => {
    toggleTransport('abc');
    expect(document.getElementById('ts-abc').classList.contains('open')).toBe(true);
    expect(document.getElementById('td-abc').classList.contains('open')).toBe(true);
  });

  test('第二次呼叫移除 open class（收合）', () => {
    toggleTransport('abc');
    toggleTransport('abc');
    expect(document.getElementById('ts-abc').classList.contains('open')).toBe(false);
    expect(document.getElementById('td-abc').classList.contains('open')).toBe(false);
  });
});

// ─────────────────────────────────────────
// renderHome — 行程卡片含複製 / 刪除按鈕
// ─────────────────────────────────────────
describe('renderHome', () => {
  const sampleTrip = {
    id: 'trip-001',
    title: '日本東京',
    year: '2026',
    country: '日本',
    dates: '3/1~3/5',
    coverEmoji: '🗼',
    days: [{ id: 'd1' }, { id: 'd2' }],
    flights: {},
  };

  beforeEach(() => {
    document.body.innerHTML = '<div id="trip-cards-container"></div>';
    global.trips = [JSON.parse(JSON.stringify(sampleTrip))];
  });

  test('每張卡片含有複製按鈕（fa-copy icon）', () => {
    renderHome();
    const html = document.getElementById('trip-cards-container').innerHTML;
    expect(html).toContain('fa-copy');
    expect(html).toContain('複製');
  });

  test('每張卡片含有刪除按鈕（fa-trash-alt icon）', () => {
    renderHome();
    const html = document.getElementById('trip-cards-container').innerHTML;
    expect(html).toContain('fa-trash-alt');
    expect(html).toContain('刪除');
  });

  test('複製按鈕 onclick 帶入正確 tripId 並呼叫 copyTrip', () => {
    renderHome();
    const html = document.getElementById('trip-cards-container').innerHTML;
    expect(html).toContain("copyTrip('trip-001')");
  });

  test('刪除按鈕 onclick 帶入正確 tripId 並呼叫 deleteTrip', () => {
    renderHome();
    const html = document.getElementById('trip-cards-container').innerHTML;
    expect(html).toContain("deleteTrip('trip-001')");
  });

  test('按鈕有 stopPropagation 防止觸發 showTrip', () => {
    renderHome();
    const html = document.getElementById('trip-cards-container').innerHTML;
    expect(html).toContain('stopPropagation');
  });

  test('trip-card-actions 區塊正確渲染', () => {
    renderHome();
    expect(document.querySelector('.trip-card-actions')).not.toBeNull();
    expect(document.querySelectorAll('.card-action-btn').length).toBe(2);
  });

  test('顯示行程天數（days.length）', () => {
    renderHome();
    const html = document.getElementById('trip-cards-container').innerHTML;
    expect(html).toContain('2 天行程');
  });

  test('最後一張卡片為「新增旅程」', () => {
    renderHome();
    const html = document.getElementById('trip-cards-container').innerHTML;
    expect(html).toContain('新增旅程');
    expect(html).toContain('add-trip-card');
  });

  test('沒有行程時只有「新增旅程」卡片，無 trip-card-actions', () => {
    global.trips = [];
    renderHome();
    expect(document.querySelector('.trip-card-actions')).toBeNull();
    expect(document.getElementById('trip-cards-container').innerHTML).toContain('新增旅程');
  });
});
