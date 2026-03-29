// State for Form Editor
let editingTrip = null;
let currentActiveDayIndex = -1;
let isSaving = false; // 新增鎖定變數，防止重複點擊儲存

// Tab Switching
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.ed-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.ed-tab').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.ed-pane').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
        });
    });
});

window.openEditor = function(tripId) {
  document.getElementById('editor-error').style.display = 'none';
  
  // 如果沒有傳入 tripId，但畫面正在顯示某個行程，就當作編輯該行程
  if (!tripId && window.currentTrip) {
    tripId = window.currentTrip.id;
  }

  if (!tripId) {
    editingTrip = {
      id: "trip-" + Date.now(),
      title: "", subtitle: "", year: "2026", dates: "", country: "", coverEmoji: "✈️",
      flights: {
        outbound: { label: "", icon: "fa-plane-arrival", iconColor: "#6fcf97", route: "", detail: "", iata: "", scheduledTime: "" },
        inbound: { label: "", icon: "fa-plane-departure", iconColor: "#f6c90e", route: "", detail: "", iata: "", scheduledTime: "" }
      },
      tickets: [],
      days: []
    };
  } else {
    // Note: global 'currentTrip' and 'trips' from app.js
    const trip = window.currentTrip || window.trips.find(t => t.id === tripId);
    editingTrip = JSON.parse(JSON.stringify(trip)); // deep copy
  }
  
  // Populate Basic
  document.getElementById('fm-title').value = editingTrip.title.replace(/\n/g, ' ');
  document.getElementById('fm-subtitle').value = editingTrip.subtitle;
  document.getElementById('fm-country').value = editingTrip.country;
  document.getElementById('fm-year').value = editingTrip.year;
  document.getElementById('fm-dates').value = editingTrip.dates;
  document.getElementById('fm-emoji').value = editingTrip.coverEmoji;

  // Populate Flights
  const fout = editingTrip.flights.outbound || {};
  document.getElementById('fm-out-label').value = fout.label || '';
  document.getElementById('fm-out-iata').value = fout.iata || '';
  document.getElementById('fm-out-time').value = fout.scheduledTime || '';
  document.getElementById('fm-out-route').value = fout.route || '';
  document.getElementById('fm-out-detail').value = fout.detail || '';

  const fin = editingTrip.flights.inbound || {};
  document.getElementById('fm-in-label').value = fin.label || '';
  document.getElementById('fm-in-iata').value = fin.iata || '';
  document.getElementById('fm-in-time').value = fin.scheduledTime || '';
  document.getElementById('fm-in-route').value = fin.route || '';
  document.getElementById('fm-in-detail').value = fin.detail || '';

  // Reset to first tab
  const btn = document.querySelector('.ed-tab[data-tab="basic"]');
  if(btn) btn.click();
  
  renderTicketsUI();
  
  currentActiveDayIndex = -1;
  renderDaysSidebarUI();

  document.getElementById('editor-modal').classList.add('open');
};

window.closeEditor = function() {
  document.getElementById('editor-modal').classList.remove('open');
};

function renderTicketsUI() {
  const container = document.getElementById('fm-tickets-list');
  container.innerHTML = editingTrip.tickets.map((t, i) => `
    <div class="ticket-row" data-idx="${i}">
      <div class="form-group"><label>票券名稱</label><input type="text" value="${t.name}" class="tk-name"></div>
      <div class="form-group"><label>適用區間</label><input type="text" value="${t.route}" class="tk-route"></div>
      <div class="form-group"><label>狀態</label>
        <select class="tk-status" style="width:100%;padding:0.7rem;border-radius:8px;border:1.5px solid var(--border);">
          <option value="ok" ${t.status==='ok'?'selected':''}>已完成</option>
          <option value="ready" ${t.status==='ready'?'selected':''}>準備</option>
          <option value="onsite" ${t.status==='onsite'?'selected':''}>現場買</option>
          <option value="pending" ${t.status==='pending'?'selected':''}>待購</option>
        </select>
      </div>
      <div class="form-group"><label>費用</label><input type="text" value="${t.cost}" class="tk-cost"></div>
      <div class="form-group"><label>備註</label><input type="text" value="${t.note}" class="tk-note"></div>
      <button class="btn-ghost" onclick="delTicketUI(${i})" style="color:var(--danger);border-color:transparent;"><i class="fas fa-trash"></i></button>
    </div>
  `).join('');
}

window.addTicketUI = function() {
  saveTicketsState();
  editingTrip.tickets.push({ name: "", route: "", status: "pending", cost: "", note: "" });
  renderTicketsUI();
};

window.delTicketUI = function(idx) {
  saveTicketsState();
  editingTrip.tickets.splice(idx, 1);
  renderTicketsUI();
};

function saveTicketsState() {
  const rows = document.querySelectorAll('.ticket-row');
  editingTrip.tickets = Array.from(rows).map(row => ({
    name: row.querySelector('.tk-name').value,
    route: row.querySelector('.tk-route').value,
    status: row.querySelector('.tk-status').value,
    cost: row.querySelector('.tk-cost').value,
    note: row.querySelector('.tk-note').value
  }));
}

function renderDaysSidebarUI() {
  const sb = document.getElementById('fm-days-sidebar');
  const dBtns = editingTrip.days.map((d, i) => `
    <button class="day-sel-btn ${currentActiveDayIndex === i ? 'active' : ''}" onclick="selectDayUI(${i})">Day ${d.day}</button>
  `).join('');
  sb.innerHTML = dBtns + ` <button class="day-add-btn" onclick="addDayUI()"><i class="fas fa-plus"></i> 新增一天</button> `;
  
  if (editingTrip.days.length > 0 && currentActiveDayIndex === -1) {
    selectDayUI(0);
  } else if (editingTrip.days.length === 0) {
    document.getElementById('fm-day-editor-area').innerHTML = '<div class="text-center text-muted" style="margin-top:2rem;">請在左側點擊「新增一天」</div>';
  }
}

window.addDayUI = function() {
  saveDayState();
  const dayNum = editingTrip.days.length + 1;
  editingTrip.days.push({
    id: "day" + dayNum, day: dayNum, date: "", subtitle: "",
    weather: { lat: 35.6895, lon: 139.6917, label: "東京", date: "2026-04-01" },
    timeline: [], food: [], accommodation: null
  });
  selectDayUI(editingTrip.days.length - 1);
};

window.selectDayUI = function(idx) {
  if (currentActiveDayIndex >= 0 && currentActiveDayIndex < editingTrip.days.length) {
    saveDayState();
  }
  currentActiveDayIndex = idx;
  renderDaysSidebarUI(); // update active state
  renderDayEditor(idx);
};

function renderDayEditor(idx) {
  const day = editingTrip.days[idx];
  const foodItems = (day.food || []);
  const accom = day.accommodation || null;

  const tpl = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
      <h3 class="pane-title" style="margin:0;border:none;">編輯 Day ${day.day}</h3>
      <button class="btn-ghost" onclick="delDayUI(${idx})" style="color:var(--danger);padding:0.3rem 0.6rem;"><i class="fas fa-trash"></i> 刪除此天</button>
    </div>
    <div class="form-grid mb-4">
      <div class="form-group"><label>日期 (例如 4/1 星期二)</label><input type="text" id="fm-d-date" value="${day.date}"></div>
      <div class="form-group"><label>副標題 (例如 紅眼落地)</label><input type="text" id="fm-d-sub" value="${day.subtitle}"></div>
      <div class="form-group"><label>天氣-地標</label><input type="text" id="fm-d-wlabel" value="${day.weather?.label||''}"></div>
      <div class="form-group"><label>天氣-時間(YYYY-MM-DD)</label><input type="text" id="fm-d-wdate" value="${day.weather?.date||''}"></div>
    </div>
    
    <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);padding-bottom:0.4rem;margin-bottom:0.8rem;">
      <h4 style="font-size:0.8rem;font-weight:700;">⏱ 行程時間軸</h4>
      <button class="btn-ghost" style="padding:0.2rem 0.5rem;" onclick="addTimelineUI()"><i class="fas fa-plus"></i></button>
    </div>
    <div id="fm-d-timeline">${ day.timeline.map((tl, i) => `
      <div class="tl-row idx-${i}">
        <div class="drag-handle" style="display:flex;align-items:center;justify-content:center;cursor:grab;color:var(--muted);"><i class="fas fa-bars"></i></div>
        <div class="form-group tl-time-wrap"><input type="text" value="${tl.time||''}" placeholder="09:00" class="tl-time"></div>
        <div class="form-group tl-title-wrap"><input type="text" value="${tl.title||''}" placeholder="地點/事件" class="tl-title"></div>
        <div class="form-group tl-desc-wrap"><input type="text" value="${tl.desc||''}" placeholder="備註說明" class="tl-desc"></div>
        <button class="btn-ghost tl-addr-toggle ${tl.address ? 'has-address' : ''}" type="button" onclick="toggleAddressUI(this)" title="填寫地址"><i class="fas fa-map-marker-alt"></i></button>
        <button class="btn-ghost" onclick="delTimelineUI(this)" style="color:var(--danger);border-color:transparent;padding:0.5rem;"><i class="fas fa-times"></i></button>
        <div class="tl-address-row" style="${tl.address ? '' : 'display:none'}">
          <input type="text" value="${tl.address||''}" placeholder="地址或 Maps 搜尋關鍵字" class="tl-address">
        </div>
      </div>
    `).join('') }</div>

    <!-- 🍽 備選餐廳 -->
    <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);padding-bottom:0.4rem;margin:1.5rem 0 0.8rem;">
      <h4 style="font-size:0.8rem;font-weight:700;">🍽 備選餐廳</h4>
      <button class="btn-ghost" style="padding:0.2rem 0.5rem;" onclick="addFoodUI()"><i class="fas fa-plus"></i></button>
    </div>
    <div id="fm-d-food">${foodItems.map((f, i) => `
      <div class="food-row" style="display:flex;gap:0.4rem;align-items:center;margin-bottom:0.4rem;">
        <div class="form-group" style="flex:1"><input type="text" value="${f.name||''}" placeholder="餐廳名稱" class="fd-name"></div>
        <div class="form-group" style="flex:0.6"><input type="text" value="${f.category||''}" placeholder="類別（拉麵/壽司）" class="fd-cat"></div>
        <button class="btn-ghost" onclick="delFoodUI(this)" style="color:var(--danger);border-color:transparent;padding:0.5rem;"><i class="fas fa-times"></i></button>
      </div>
    `).join('')}</div>

    <!-- 🛏 住宿 -->
    <div style="border-bottom:1px solid var(--border);padding-bottom:0.4rem;margin:1.5rem 0 0.8rem;">
      <h4 style="font-size:0.8rem;font-weight:700;">🛏 住宿</h4>
    </div>
    <div class="form-grid" id="fm-d-accom">
      <div class="form-group"><label>旅館名稱</label><input type="text" id="fm-accom-name" value="${accom?.name||''}" placeholder="例如 東橫INN"></div>
      <div class="form-group"><label>地址</label><input type="text" id="fm-accom-addr" value="${accom?.address||''}" placeholder="完整地址"></div>
    </div>
  `;
  document.getElementById('fm-day-editor-area').innerHTML = tpl;

  const tlContainer = document.getElementById('fm-d-timeline');
  if (tlContainer && typeof Sortable !== 'undefined') {
    new Sortable(tlContainer, {
      animation: 150,
      handle: '.drag-handle',
      ghostClass: 'sortable-ghost',
      onEnd: function() {
        saveDayState();
      }
    });
  }
}

window.addFoodUI = function() {
  saveDayState();
  if (!editingTrip.days[currentActiveDayIndex].food) editingTrip.days[currentActiveDayIndex].food = [];
  editingTrip.days[currentActiveDayIndex].food.push({ name: '', category: '' });
  renderDayEditor(currentActiveDayIndex);
};
window.delFoodUI = function(btn) {
  const row = btn.closest('.food-row');
  if (row) row.remove();
  saveDayState();
  renderDayEditor(currentActiveDayIndex);
};

window.addTimelineUI = function() {
  saveDayState();
  editingTrip.days[currentActiveDayIndex].timeline.push({time:"", title:"", desc:"", address:""});
  renderDayEditor(currentActiveDayIndex);
}
window.toggleAddressUI = function(btn) {
  const row = btn.closest('.tl-row');
  const addrRow = row.querySelector('.tl-address-row');
  const isHidden = addrRow.style.display === 'none';
  addrRow.style.display = isHidden ? '' : 'none';
  if (isHidden) addrRow.querySelector('.tl-address').focus();
};

window.delTimelineUI = function(btn) {
  const row = btn.closest('.tl-row');
  if (row) row.remove();
  saveDayState();
  renderDayEditor(currentActiveDayIndex);
}

window.delDayUI = function(idx) {
  if(!confirm('確定刪除這一天嗎？')) return;
  editingTrip.days.splice(idx, 1);
  currentActiveDayIndex = editingTrip.days.length > 0 ? 0 : -1;
  renderDaysSidebarUI();
  if(currentActiveDayIndex > -1) renderDayEditor(currentActiveDayIndex);
}

function saveDayState() {
  if (currentActiveDayIndex < 0 || currentActiveDayIndex >= editingTrip.days.length) return;
  const day = editingTrip.days[currentActiveDayIndex];
  day.date = document.getElementById('fm-d-date')?.value || '';
  day.subtitle = document.getElementById('fm-d-sub')?.value || '';
  if(!day.weather) day.weather = {};
  day.weather.label = document.getElementById('fm-d-wlabel')?.value || '';
  day.weather.date = document.getElementById('fm-d-wdate')?.value || '';
  
  const tlRows = document.querySelectorAll('#fm-d-timeline .tl-row');
  day.timeline = Array.from(tlRows).map(row => {
    const timeEl = row.querySelector('.tl-time');
    const titleEl = row.querySelector('.tl-title');
    const descEl = row.querySelector('.tl-desc');
    if (!timeEl || !titleEl || !descEl) return null;

    const data = {
      time: timeEl.value,
      title: titleEl.value,
      desc: descEl.value,
      address: row.querySelector('.tl-address')?.value || ''
    };
    return data;
  }).filter(t => t !== null);

  // 儲存餐廳
  const foodRows = document.querySelectorAll('#fm-d-food .food-row');
  day.food = Array.from(foodRows).map(row => {
    const name = row.querySelector('.fd-name')?.value || '';
    const category = row.querySelector('.fd-cat')?.value || '';
    if (!name) return null;
    return { name, category };
  }).filter(f => f !== null);

  // 儲存住宿
  const accomName = document.getElementById('fm-accom-name')?.value || '';
  const accomAddr = document.getElementById('fm-accom-addr')?.value || '';
  if (accomName) {
    day.accommodation = {
      name: accomName,
      address: accomAddr,
      mapQuery: accomName
    };
  } else {
    day.accommodation = null;
  }
}

function saveToLocalStorage(trip) {
  const stored = JSON.parse(localStorage.getItem('travel_planner_trips') || '[]');
  const idx = stored.findIndex(t => t.id === trip.id);
  if (idx >= 0) stored[idx] = trip;
  else stored.push(trip);
  localStorage.setItem('travel_planner_trips', JSON.stringify(stored));
}

let currentGeocodeTarget = null; // { row, titleInput }

window.fetchCoordinates = async function(btn) {
  const row = btn.closest('.tl-row');
  const titleInput = row.querySelector('.tl-title');
  const initialTitle = titleInput.value.trim();
  
  if (!initialTitle) {
    if (typeof showToast === 'function') showToast('請先輸入地點名稱', 'warn');
    return;
  }

  const country = editingTrip.country || '';
  const autoQuery = initialTitle.includes(country) ? initialTitle : `${initialTitle} ${country}`;

  currentGeocodeTarget = { row, titleInput };
  openGeocodeModal(autoQuery);
};

window.openGeocodeModal = function(defaultQuery) {
  document.getElementById('gc-query-input').value = defaultQuery;
  document.getElementById('gc-step-1').style.display = 'block';
  document.getElementById('gc-step-2').style.display = 'none';
  document.getElementById('gc-error').style.display = 'none';
  document.getElementById('geocode-modal').classList.add('open');
};

window.closeGeocodeModal = function() {
  document.getElementById('geocode-modal').classList.remove('open');
  currentGeocodeTarget = null;
};

window.resetGeocodeModal = function() {
  document.getElementById('gc-step-1').style.display = 'block';
  document.getElementById('gc-step-2').style.display = 'none';
};

window.executeGeocodeSearch = async function() {
  const query = document.getElementById('gc-query-input').value.trim();
  const errEl = document.getElementById('gc-error');
  const btn = document.getElementById('gc-search-btn');
  
  if (!query) {
    errEl.textContent = '搜尋字串不可為空';
    errEl.style.display = 'block';
    return;
  }

  errEl.style.display = 'none';
  const originalBtnText = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>';
  btn.disabled = true;

  try {
    // 檢查直接輸入的座標或 Plus Codes
    const llMatch = query.match(/^(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)$/);
    if (llMatch) {
      showGeocodeResult({ lat: llMatch[1], lon: llMatch[2], address: '手動輸入的精確經緯度座標' });
      return;
    }
    
    let resData = null;

    // 1. 嘗試呼叫 Supabase Edge Function (Google Maps)
    // ⚠️ 尚未部署 Edge Function 前請保持 false，避免 CORS 噴錯
    const EDGE_FUNCTION_READY = false;
    if (EDGE_FUNCTION_READY && window.supabaseClient && window.currentUser) {
       try {
         const { data, error } = await window.supabaseClient.functions.invoke('geocode', {
           body: { query: query }
         });
         if (!error && data && data.found) {
           resData = { lat: data.lat, lon: data.lon, address: data.address };
         } else if (data && !data.found) {
           console.warn('Google Maps 找不到:', data.message);
         }
       } catch(edgeErr) {
         console.warn('Edge function unavailable, using Nominatim:', edgeErr);
       }
    }

    // 2. Fallback 回原本的 Nominatim (開發階段未綁定鑰匙的後備方案)
    if (!resData) {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
      const data = await res.json();
      if (data && data.length > 0) {
        resData = { lat: data[0].lat, lon: data[0].lon, address: data[0].display_name };
      }
    }

    if (resData) {
      showGeocodeResult(resData);
    } else {
      errEl.textContent = '找不到此地點的座標，請嘗試提供更完整的地址或地名。';
      errEl.style.display = 'block';
    }
  } catch(e) {
    errEl.textContent = '搜尋發生網路錯誤或伺服器異常。';
    errEl.style.display = 'block';
  } finally {
    btn.innerHTML = originalBtnText;
    btn.disabled = false;
  }
};

window.showGeocodeResult = function(data) {
  document.getElementById('gc-step-1').style.display = 'none';
  document.getElementById('gc-step-2').style.display = 'block';
  document.getElementById('gc-result-address').textContent = data.address;
  document.getElementById('gc-result-lat').value = data.lat;
  document.getElementById('gc-result-lon').value = data.lon;
};

window.confirmGeocodeBind = function() {
  if (!currentGeocodeTarget) return;
  const { row, titleInput } = currentGeocodeTarget;
  
  row.querySelector('.tl-lat').value = document.getElementById('gc-result-lat').value;
  row.querySelector('.tl-lon').value = document.getElementById('gc-result-lon').value;
  
  if (!titleInput.classList.contains('has-coord')) {
    titleInput.classList.add('has-coord');
  }
  
  saveDayState();
  if (typeof showToast === 'function') showToast(`✅ 座標已成功綁定`, 'success');
  closeGeocodeModal();
};

window.saveFormEditor = function() {
  if (isSaving) {
    console.warn('儲存鎖卡住，強制解鎖');
    isSaving = false;
  }
  isSaving = true;
  
  try {
    saveTicketsState();
    saveDayState();
    
    // Basic Info
    editingTrip.title = (document.getElementById('fm-title')?.value || '').replace(/\n/g, ' ');
    editingTrip.subtitle = document.getElementById('fm-subtitle')?.value || '';
    editingTrip.country = document.getElementById('fm-country')?.value || '';
    editingTrip.year = document.getElementById('fm-year')?.value || '';
    editingTrip.dates = document.getElementById('fm-dates')?.value || '';
    editingTrip.coverEmoji = document.getElementById('fm-emoji')?.value || '✈️';
    
    // Flights
    if(!editingTrip.flights) editingTrip.flights = { outbound: {}, inbound: {} };
    const fout = editingTrip.flights.outbound || {};
    editingTrip.flights.outbound = {
      ...fout,
      label: document.getElementById('fm-out-label')?.value || '',
      iata: document.getElementById('fm-out-iata')?.value || '',
      scheduledTime: document.getElementById('fm-out-time')?.value || '',
      route: document.getElementById('fm-out-route')?.value || '',
      detail: document.getElementById('fm-out-detail')?.value || '',
    };
    const fin = editingTrip.flights.inbound || {};
    editingTrip.flights.inbound = {
      ...fin,
      label: document.getElementById('fm-in-label')?.value || '',
      iata: document.getElementById('fm-in-iata')?.value || '',
      scheduledTime: document.getElementById('fm-in-time')?.value || '',
      route: document.getElementById('fm-in-route')?.value || '',
      detail: document.getElementById('fm-in-detail')?.value || '',
    };
    
    // 全域清單同步
    const idx = window.trips.findIndex(t => t.id === editingTrip.id);
    if (idx >= 0) window.trips[idx] = editingTrip;
    else window.trips.push(editingTrip);

    editingTrip._localUpdatedAt = Date.now();
    saveToLocalStorage(editingTrip);

    // ★ 先關閉編輯器、更新畫面（不等雲端）
    closeEditor();
    window.renderHome();
    if (window.currentTrip && window.currentTrip.id === editingTrip.id) {
      window.currentTrip = editingTrip;
      window.renderTripContent(editingTrip);
    }

    // ★ 雲端同步改為背景執行（不阻塞 UI）
    if (window.currentUser && typeof window.saveToCloud === 'function') {
      window.saveToCloud(editingTrip).then(() => {
        if(typeof showToast === 'function') showToast('✅ 已同步至雲端', 'success');
      }).catch(err => {
        console.warn('雲端同步失敗（本機已存檔）:', err);
        if(typeof showToast === 'function') showToast('雲端同步失敗，已保留本機備份', 'warn');
      });
    } else {
      if(typeof showToast === 'function') showToast('✅ 成功儲存（本機）', 'success');
    }

  } catch (err) {
    console.error('儲存功能發生嚴重錯誤:', err);
    if(typeof showToast === 'function') showToast('儲存失敗：' + err.message, 'warn');
  } finally {
    isSaving = false;
  }
};
