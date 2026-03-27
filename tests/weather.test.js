/**
 * tests/weather.test.js
 * 測試 js/weather.js — WMO_MAP, getOutfitTip, fetchWeather, loadWeatherForDay
 */

// 初始化 sessionStorage mock（weather.js 在模組載入時即讀取它）
global.sessionStorage = {
  _store: {},
  getItem(key) { return this._store[key] ?? null; },
  setItem(key, val) { this._store[key] = String(val); },
  clear() { this._store = {}; },
};

const { WMO_MAP, getOutfitTip, fetchWeather, loadWeatherForDay, weatherCache } = require('../js/weather.js');

// ─────────────────────────────────────────
// WMO_MAP 資料完整性
// ─────────────────────────────────────────
describe('WMO_MAP', () => {
  test('每個 code 都有 icon 和 text', () => {
    Object.entries(WMO_MAP).forEach(([code, val]) => {
      expect(val).toHaveProperty('icon');
      expect(val).toHaveProperty('text');
      expect(typeof val.icon).toBe('string');
      expect(typeof val.text).toBe('string');
    });
  });

  test('晴天代碼 0 = 晴天', () => {
    expect(WMO_MAP[0].text).toBe('晴天');
  });

  test('雷雨代碼 95 有雷雨圖示', () => {
    expect(WMO_MAP[95].text).toBe('雷雨');
  });

  test('所有已知代碼都有定義', () => {
    const knownCodes = [0, 1, 2, 3, 45, 48, 51, 53, 55, 61, 63, 65, 71, 73, 75, 80, 81, 82, 95, 96];
    knownCodes.forEach(code => {
      expect(WMO_MAP[code]).toBeDefined();
    });
  });
});

// ─────────────────────────────────────────
// getOutfitTip — 純函式
// ─────────────────────────────────────────
describe('getOutfitTip', () => {
  describe('溫度建議', () => {
    test('22°C 以上 → 輕薄外套', () => {
      expect(getOutfitTip(25, 0)).toBe('輕薄外套');
      expect(getOutfitTip(22, 0)).toBe('輕薄外套');
    });

    test('16~21°C → 薄外套必備', () => {
      expect(getOutfitTip(20, 0)).toBe('薄外套必備');
      expect(getOutfitTip(16, 0)).toBe('薄外套必備');
    });

    test('15°C 以下 → 保暖外套', () => {
      expect(getOutfitTip(15, 0)).toBe('保暖外套');
      expect(getOutfitTip(5, 0)).toBe('保暖外套');
    });
  });

  describe('雨傘建議', () => {
    test('降雨機率 >= 50% → 加上「帶傘」', () => {
      expect(getOutfitTip(25, 50)).toBe('輕薄外套 + 帶傘');
      expect(getOutfitTip(10, 80)).toBe('保暖外套 + 帶傘');
    });

    test('降雨機率 < 50% → 不加「帶傘」', () => {
      expect(getOutfitTip(25, 49)).toBe('輕薄外套');
      expect(getOutfitTip(10, 0)).toBe('保暖外套');
    });
  });
});

// ─────────────────────────────────────────
// fetchWeather — 模擬 fetch
// ─────────────────────────────────────────
describe('fetchWeather', () => {
  const LAT = 35.6895, LON = 139.6917, DATE = '2026-04-01';

  // 成功回應的 mock 資料
  const mockResponse = {
    daily: {
      time: [DATE],
      temperature_2m_max: [22],
      temperature_2m_min: [14],
      weather_code: [3],
      precipitation_probability_max: [40],
    }
  };

  beforeEach(() => {
    // 清除模組內快取（weatherCache 是物件參考，清空 keys 即可）
    Object.keys(weatherCache).forEach(k => delete weatherCache[k]);
    sessionStorage.clear();
    jest.clearAllMocks();
  });

  test('成功回傳天氣資料', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true, status: 200,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await fetchWeather(LAT, LON, DATE);

    expect(result).not.toBeNull();
    expect(result.max).toBe(22);
    expect(result.min).toBe(14);
    expect(result.code).toBe(3);
    expect(result.rainProb).toBe(40);
    expect(result.historical).toBe(false);
  });

  test('快取命中時不重複呼叫 fetch', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true, status: 200,
      json: () => Promise.resolve(mockResponse),
    });

    await fetchWeather(LAT, LON, DATE);
    await fetchWeather(LAT, LON, DATE); // 第二次應命中快取

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('API 回傳非 ok 時改用歷史資料（archive）', async () => {
    const histResponse = {
      daily: {
        time: ['2025-07-01'],
        temperature_2m_max: [19],
        temperature_2m_min: [11],
        weather_code: [1],
      }
    };
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: false, status: 500, json: () => Promise.resolve({}) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(histResponse) });

    // 用不同日期確保不命中其他測試快取
    const result = await fetchWeather(LAT, LON, '2026-07-01');
    expect(result).not.toBeNull();
    expect(result.historical).toBe(true);
    expect(result.max).toBe(19);
  });

  test('fetch 拋出例外時回傳 null', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    const result = await fetchWeather(LAT, LON, '2026-05-01'); // 不同 key 避免快取干擾
    expect(result).toBeNull();
  });

  test('429 Too Many Requests 後重試', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: false, status: 429 })
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(mockResponse) });

    jest.useFakeTimers();
    const promise = fetchWeather(LAT, LON, '2026-06-01');
    jest.advanceTimersByTime(1000);
    jest.useRealTimers();

    const result = await promise;
    expect(result).not.toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});

// ─────────────────────────────────────────
// loadWeatherForDay — DOM 整合
// ─────────────────────────────────────────
describe('loadWeatherForDay', () => {
  const day = {
    id: 'day1',
    weather: { lat: 35.6895, lon: 139.6917, date: '2026-04-01', label: '東京' }
  };

  beforeEach(() => {
    document.body.innerHTML = `<div class="weather-badge" id="weather-day1"></div>`;
    Object.keys(weatherCache).forEach(k => delete weatherCache[k]);
    sessionStorage.clear();
    jest.clearAllMocks();
  });

  test('成功載入後顯示溫度', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true, status: 200,
      json: () => Promise.resolve({
        daily: {
          time: ['2026-04-01'],
          temperature_2m_max: [20], temperature_2m_min: [12],
          weather_code: [0], precipitation_probability_max: [10],
        }
      }),
    });

    await loadWeatherForDay(day);
    const el = document.getElementById('weather-day1');
    // mock 回傳 max:20, min:12
    expect(el.innerHTML).toContain('12~20°C');
    expect(el.innerHTML).toContain('東京');
  });

  test('fetch 失敗時顯示錯誤文字', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('fail'));

    await loadWeatherForDay(day);
    const el = document.getElementById('weather-day1');
    expect(el.textContent).toContain('天氣資料無法載入');
  });

  test('weather-badge 元素不存在時不拋例外', async () => {
    document.body.innerHTML = ''; // 清空 DOM
    global.fetch = jest.fn();

    await expect(loadWeatherForDay(day)).resolves.not.toThrow();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
