// ═══════════════════════════════════════
// RENDER — Home
// ═══════════════════════════════════════
function renderHome() {
  const container = document.getElementById('trip-cards-container');
  container.innerHTML = trips.map((trip) => `
    <div class="trip-card" onclick="showTrip('${trip.id}')">
      <div class="trip-card-year">${trip.year} · ${trip.country}</div>
      <div class="trip-card-title">${trip.coverEmoji} ${trip.title.replace('\n', '<br>')}</div>
      <div class="trip-card-meta">
        <span><i class="fas fa-calendar-alt" style="font-size:0.65rem;color:var(--gold)"></i> ${trip.dates}</span>
        <span><i class="fas fa-map-marked-alt" style="font-size:0.65rem;color:var(--gold)"></i> ${trip.days.length} 天行程</span>
      </div>
    </div>
  `).join('') + `
    <div class="trip-card add-trip-card" onclick="openEditor(null)">
      <i class="fas fa-plus" style="font-size:1.2rem"></i>
      <div style="font-size:0.8rem;letter-spacing:0.1em">新增旅程</div>
    </div>
  `;
}
window.renderHome = renderHome;

// ═══════════════════════════════════════
// RENDER — Navigation
// ═══════════════════════════════════════
function showHome() {
  document.getElementById('trip-selector').style.display = 'flex';
  document.getElementById('trip-detail').style.display = 'none';
  currentTrip = null;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.showHome = showHome;

function showTrip(id) {
  const trip = trips.find(t => t.id === id);
  if (!trip) return;
  currentTrip = trip;

  document.getElementById('trip-selector').style.display = 'none';
  document.getElementById('trip-detail').style.display = 'block';
  document.getElementById('detail-title-text').textContent = trip.title.replace('\n', ' ');

  const pillsContainer = document.getElementById('day-nav-pills');
  pillsContainer.innerHTML = trip.days.map(day => `
    <button class="day-pill" onclick="scrollToDay('${day.id}')" id="pill-${day.id}">
      Day ${day.day} ${day.date}
    </button>
  `).join('');

  renderTripContent(trip);
}
window.showTrip = showTrip;

function scrollToDay(dayId) {
  const el = document.getElementById(dayId);
  if (el) {
    const y = el.getBoundingClientRect().top + window.scrollY - 130;
    window.scrollTo({ top: y, behavior: 'smooth' });
  }
}
window.scrollToDay = scrollToDay;

// ═══════════════════════════════════════
// RENDER — Trip Content
// ═══════════════════════════════════════
function renderTripContent(trip) {
  const main = document.getElementById('trip-main-content');

  const flightsHTML = `
    <div class="flights-banner">
      ${renderFlight(trip.flights.outbound, 'status-out')}
      ${renderFlight(trip.flights.inbound, 'status-in')}
    </div>`;

  const statusMap   = { ok: 'status-ok', ready: 'status-ready', onsite: 'status-onsite', pending: 'status-pending' };
  const statusLabel = { ok: '已完成', ready: '憑證準備', onsite: '現場購買', pending: '待購' };
  const ticketsHTML = `
    <div class="ticket-section">
      <div class="ticket-header"><i class="fas fa-ticket-alt"></i> 交通票券總表</div>
      <div style="overflow-x:auto">
      <table>
        <thead><tr><th>票券</th><th>適用區間</th><th>狀態</th><th>費用</th><th>備註</th></tr></thead>
        <tbody>
          ${trip.tickets.map(t => `
            <tr>
              <td style="color:var(--ink);font-weight:400;font-family:var(--serif-tc)">${t.name}</td>
              <td>${t.route}</td>
              <td><span class="status-badge ${statusMap[t.status] || 'status-onsite'}">${statusLabel[t.status] || t.status}</span></td>
              <td style="font-family:monospace;color:var(--charcoal)">${t.cost}</td>
              <td>${t.note}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      </div>
    </div>`;

  const daysHTML = trip.days.map(day => renderDay(day)).join('');

  main.innerHTML = flightsHTML + ticketsHTML + daysHTML;

  // 循序載入天氣（避免 API 429）
  (async () => {
    for (const day of trip.days) {
      if (day.weather) await loadWeatherForDay(day);
    }
  })();

  autoScrollToday(trip);
  initMaps(trip);
}
window.renderTripContent = renderTripContent;

function renderFlight(f, statusId) {
  return `
    <div class="flight-row">
      <i class="fas ${f.icon} flight-icon"></i>
      <div>
        <div class="flight-label">${f.label}</div>
        <div class="flight-route">${f.route}</div>
        <div class="flight-detail-text">${f.detail}</div>
        <div class="flight-status" id="${statusId}">
          <i class="fas fa-circle-notch fa-spin" style="font-size:0.6rem"></i> 查詢動態中
        </div>
      </div>
    </div>`;
}

function renderDay(day) {
  const e = window.escapeHTML;
  const chipColors = ['', '#4f7ef8', '#38b27e', '#e05c5c', '#9b6fe8', '#f09030', '#2eadd4', '#e8609a', '#6b8c6b'];
  const chipColor  = chipColors[day.day] || '#888';

  const tlItems = day.timeline.map((item) => `
    <div class="tl-item">
      <div class="tl-time">${e(item.time || '')}</div>
      <div class="tl-body">
        <div class="tl-title">${e(item.title)}</div>
        ${item.desc ? `<div class="tl-desc">${e(item.desc)}</div>` : ''}
        ${item.transport ? renderTransport(item.transport) : ''}
      </div>
    </div>
  `).join('');

  const foodHTML = day.food && day.food.length > 0 ? `
    <div class="food-section">
      <div class="food-section-label">🍽 餐廳備選</div>
      <div class="food-grid">
        ${day.food.map(f => `
          <a class="food-tag" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(f.name)}" target="_blank" title="${e(f.category)}">
            <i class="fas fa-utensils" style="font-size:0.62rem"></i>
            ${e(f.name)}
            <span style="opacity:0.65;font-size:0.68rem">${e(f.category)}</span>
          </a>
        `).join('')}
      </div>
    </div>` : '';

  const accomHTML = day.accommodation ? `
    <div class="accom-card">
      <i class="fas fa-bed accom-icon"></i>
      <div>
        <div class="accom-label">今日住宿</div>
        <div class="accom-name">${e(day.accommodation.name)}</div>
        <div class="accom-addr">
          <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(day.accommodation.mapQuery || day.accommodation.name)}" target="_blank">
            <i class="fas fa-map-marker-alt" style="font-size:0.62rem;margin-right:3px"></i>${e(day.accommodation.address)}
          </a>
        </div>
      </div>
    </div>` : '';

  const hasMap = day.timeline.some(t => t.lat && t.lon);
  const mapHTML = hasMap ? `<div class="day-map" id="map-${day.id}"></div>` : '';

  return `
    <div class="day-section" id="${day.id}" style="animation-delay:${(day.day - 1) * 0.05}s">
      <div class="day-header">
        <div class="day-header-left">
          <div class="day-chip" style="background:${chipColor}">
            ${String(day.day).padStart(2, '0')}
          </div>
          <div>
            <div class="day-date">${e(day.date)}</div>
            <div class="day-subtitle-text">${e(day.subtitle)}</div>
          </div>
        </div>
      </div>
      <div class="weather-badge" id="weather-${day.id}">
        <i class="fas fa-circle-notch fa-spin" style="font-size:0.7rem;color:var(--muted)"></i>
        <span style="color:var(--muted)">載入天氣中⋯</span>
      </div>
      ${mapHTML}
      <div class="timeline">${tlItems}</div>
      ${foodHTML}
      ${accomHTML}
    </div>
  `;
}

function renderTransport(t) {
  const e = window.escapeHTML;
  const tagsHTML = (t.tags || []).map(tag => `<span class="transport-tag">${e(tag)}</span>`).join('');
  const uid = 'tr' + Math.random().toString(36).slice(2, 7);
  return `
    <div class="transport-card">
      <div class="transport-summary" id="ts-${uid}" onclick="toggleTransport('${uid}')">
        <i class="fas fa-train" style="font-size:0.75rem"></i>
        <span>${e(t.summary)}</span>
        <i class="fas fa-chevron-down chevron"></i>
      </div>
      <div class="transport-details" id="td-${uid}">
        <div style="margin-bottom:0.5rem">${tagsHTML}</div>
        ${e(t.details || '')}
      </div>
    </div>`;
}

function toggleTransport(uid) {
  document.getElementById('ts-' + uid).classList.toggle('open');
  document.getElementById('td-' + uid).classList.toggle('open');
}
window.toggleTransport = toggleTransport;

// ═══════════════════════════════════════
// MAPS — Leaflet 地圖
// ═══════════════════════════════════════
window.leafMaps = window.leafMaps || {};

function initMaps(trip) {
  if (typeof L === 'undefined') return;

  Object.values(window.leafMaps).forEach(m => { if (m) m.remove(); });
  window.leafMaps = {};

  trip.days.forEach(day => {
    const el = document.getElementById(`map-${day.id}`);
    if (!el) return;

    const validItems = day.timeline.filter(t => t.lat && t.lon);
    if (validItems.length === 0) return;

    const map = L.map(el, { scrollWheelZoom: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19
    }).addTo(map);

    const points = [];
    validItems.forEach((item, idx) => {
      points.push([item.lat, item.lon]);
      L.marker([item.lat, item.lon])
        .addTo(map)
        .bindPopup(`<b>${idx + 1}. ${item.title}</b><br>${item.time || ''}`);
    });

    if (points.length > 1) {
      L.polyline(points, { color: 'var(--d1)', weight: 4, opacity: 0.8 }).addTo(map);
      map.fitBounds(points, { padding: [30, 30] });
    } else if (points.length === 1) {
      map.setView(points[0], 14);
    }

    window.leafMaps[day.id] = map;
  });
}

// ═══════════════════════════════════════
// AUTO SCROLL — 自動捲到今天
// ═══════════════════════════════════════
function autoScrollToday(trip) {
  const now = new Date();
  const m = now.getMonth() + 1, d = now.getDate();

  trip.days.forEach(day => {
    const match = day.date.match(/(\d+)\/(\d+)/);
    if (!match) return;
    const dm = parseInt(match[1]), dd = parseInt(match[2]);
    if (dm === m && dd === d) {
      setTimeout(() => scrollToDay(day.id), 400);
      const el = document.getElementById(day.id);
      if (el) {
        el.style.outline = '2px solid var(--d1)';
        el.style.outlineOffset = '4px';
        setTimeout(() => { el.style.outline = ''; el.style.outlineOffset = ''; }, 3000);
      }
    }
  });
}

// ═══════════════════════════════════════
// FLIGHT STATUS — 模擬航班動態
// ═══════════════════════════════════════
function loadFlightStatus() {
  setTimeout(() => {
    const out = document.getElementById('status-out');
    const inn = document.getElementById('status-in');
    if (out) { out.className = 'flight-status ok'; out.innerHTML = '<i class="fas fa-check-circle"></i> 準點 On Time (模擬)'; }
    if (inn) { inn.className = 'flight-status'; inn.innerHTML = '<i class="fas fa-clock"></i> 尚未開放查詢'; }
  }, 1500);
}

// ── 測試環境 export（不影響瀏覽器行為）──
if (typeof module !== 'undefined') {
  module.exports = { renderFlight, renderDay, renderTransport, toggleTransport };
}
