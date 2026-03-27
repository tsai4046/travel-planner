// ═══════════════════════════════════════
// WEATHER API — 天氣資料與顯示
// ═══════════════════════════════════════

const WMO_MAP = {
  0:  { icon: '☀️',  text: '晴天' },
  1:  { icon: '🌤️', text: '晴時多雲' },
  2:  { icon: '⛅',  text: '部分多雲' },
  3:  { icon: '☁️',  text: '陰天' },
  45: { icon: '🌫️', text: '霧' },
  48: { icon: '🌫️', text: '霧淞' },
  51: { icon: '🌦️', text: '毛毛雨' },
  53: { icon: '🌦️', text: '毛毛雨' },
  55: { icon: '🌧️', text: '毛毛雨' },
  61: { icon: '🌧️', text: '陣雨' },
  63: { icon: '🌧️', text: '陣雨' },
  65: { icon: '⛈️',  text: '大雨' },
  71: { icon: '🌨️', text: '小雪' },
  73: { icon: '🌨️', text: '雪' },
  75: { icon: '❄️',  text: '大雪' },
  80: { icon: '🌦️', text: '陣雨' },
  81: { icon: '🌧️', text: '中陣雨' },
  82: { icon: '⛈️',  text: '大陣雨' },
  95: { icon: '⛈️',  text: '雷雨' },
  96: { icon: '⛈️',  text: '雷雨夾冰雹' },
};

function getOutfitTip(maxTemp, rainProb) {
  let outfit = '';
  if (maxTemp >= 22) outfit = '輕薄外套';
  else if (maxTemp >= 16) outfit = '薄外套必備';
  else outfit = '保暖外套';
  if (rainProb >= 50) outfit += ' + 帶傘';
  return outfit;
}

const WEATHER_CACHE_ID = 'travel_planner_weather_v1';
let weatherCache = {};
try {
  weatherCache = JSON.parse(sessionStorage.getItem(WEATHER_CACHE_ID) || '{}');
} catch(e) {}

async function fetchWeather(lat, lon, date) {
  const key = `${lat},${lon},${date}`;
  if (weatherCache[key]) return weatherCache[key];

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  const performFetch = async (url, retryCount = 0) => {
    try {
      const res = await fetch(url);
      if (res.status === 429 && retryCount < 1) {
        await sleep(1000);
        return performFetch(url, retryCount + 1);
      }
      if (!res.ok) return { error: true };
      return await res.json();
    } catch(e) {
      return { error: true };
    }
  };

  try {
    let url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia/Tokyo&start_date=${date}&end_date=${date}`;
    let data = await performFetch(url);

    if (data.error) {
      const histDate = date.replace(/^\d{4}/, '2025');
      const archiveUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Asia/Tokyo&start_date=${histDate}&end_date=${histDate}`;
      data = await performFetch(archiveUrl);
      if (!data || data.error) return null;
      data._historical = true;
    }

    if (data.daily && data.daily.time?.length > 0) {
      const result = {
        max:      Math.round(data.daily.temperature_2m_max[0]),
        min:      Math.round(data.daily.temperature_2m_min[0]),
        code:     data.daily.weather_code[0],
        rainProb: data.daily.precipitation_probability_max?.[0] ?? null,
        historical: !!data._historical
      };
      weatherCache[key] = result;
      sessionStorage.setItem(WEATHER_CACHE_ID, JSON.stringify(weatherCache));
      return result;
    }
  } catch (e) { console.error('Weather fetch error:', e); }
  return null;
}

async function loadWeatherForDay(day) {
  const el = document.getElementById('weather-' + day.id);
  if (!el) return;

  const w = await fetchWeather(day.weather.lat, day.weather.lon, day.weather.date);
  if (!w) {
    el.innerHTML = `<span style="opacity:0.4">天氣資料無法載入</span>`;
    return;
  }

  const wmo     = WMO_MAP[w.code] || { icon: '🌡️', text: '未知' };
  const rainHTML = w.rainProb !== null ? `<span class="rain">💧 ${w.rainProb}%</span>` : '';
  const tip      = getOutfitTip(w.max, w.rainProb || 0);
  const label    = w.historical ? `${day.weather.label} (歷年參考)` : `${day.weather.label}`;

  el.innerHTML = `
    <span>${wmo.icon}</span>
    <span class="temp">${w.min}~${w.max}°C</span>
    <span style="opacity:0.6">${wmo.text}</span>
    ${rainHTML}
    <span class="tip">👔 ${tip}</span>
    <span style="opacity:0.3;font-size:0.7rem;margin-left:auto">${label}</span>
  `;
}

// ── 測試環境 export（不影響瀏覽器行為）──
if (typeof module !== 'undefined') {
  module.exports = { WMO_MAP, getOutfitTip, fetchWeather, loadWeatherForDay, weatherCache };
}
