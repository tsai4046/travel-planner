// ═══════════════════════════════════════
// ⚙️  SUPABASE 設定 — 填入你的值
// ═══════════════════════════════════════
const SUPABASE_URL     = 'https://hjyrfjqhivbjivcmfwai.supabase.co'; // ← 改這裡
const SUPABASE_ANON_KEY = 'sb_publishable_-t1RzF99TAtTeW1lXjZurg_j2VjoU90'; // ← 改這裡

const SUPABASE_ENABLED = Boolean(SUPABASE_URL) && SUPABASE_URL.trim() !== '';

var supabaseClient = null;
var currentUser    = null;

if (SUPABASE_ENABLED) {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// ── 偵測分享連結 token ──
const urlParams  = new URLSearchParams(window.location.search);
const SHARE_TOKEN = urlParams.get('share');

// ═══════════════════════════════════════
// AUTH
// ═══════════════════════════════════════
async function initAuth() {
  if (!SUPABASE_ENABLED) {
    document.getElementById('auth-bar').style.display = 'none';
    return;
  }

  if (SHARE_TOKEN) {
    // 分享連結模式：無論已登入或訪客，處理完後都直接 return，
    // 不可註冊 onAuthStateChange，否則 SIGNED_IN / INITIAL_SESSION 事件會
    // 再次呼叫 onSignedIn → renderHome()，把分享行程畫面覆蓋掉（空白畫面）。
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session?.user) {
      await onSignedIn(session.user);
      await loadSharedTrip(SHARE_TOKEN, true);
    } else {
      await loadSharedTrip(SHARE_TOKEN);
    }
    return; // 分享模式不監聽 auth 狀態變化，避免覆蓋畫面
  } else {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session?.user) await onSignedIn(session.user);
  }

  supabaseClient.auth.onAuthStateChange(async (_event, session) => {
    if (session?.user) await onSignedIn(session.user);
    else onSignedOut();
  });
}

async function signInWithGoogle() {
  if (!SUPABASE_ENABLED) return;
  await supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + window.location.pathname }
  });
}

async function signOut() {
  if (!SUPABASE_ENABLED) return;
  await supabaseClient.auth.signOut();
  onSignedOut();
}

async function onSignedIn(user) {
  currentUser = user;
  document.getElementById('login-btn').style.display = 'none';
  const userArea = document.getElementById('user-area');
  userArea.style.display = 'flex';
  document.getElementById('user-name').textContent = user.user_metadata?.full_name || user.email;
  const avatar = user.user_metadata?.avatar_url;
  if (avatar) document.getElementById('user-avatar').src = avatar;
  document.getElementById('sync-badge').style.display = 'inline-flex';

  await loadTripsFromCloud();

  // 草稿同步：登入時將本機行程上傳至雲端
  const localTrips = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  if (localTrips.length > 0) {
    let syncCount = 0;
    for (const trip of localTrips) {
      try {
        await saveToCloud(trip);
        syncCount++;
      } catch (err) {
        console.error('同步失敗：', trip.id, err);
      }
    }
    if (syncCount > 0) showToast(`🔄 已將 ${syncCount} 筆本機行程同步至雲端`, 'info');
  }
}

function onSignedOut() {
  currentUser = null;
  document.getElementById('login-btn').style.display = 'flex';
  document.getElementById('user-area').style.display = 'none';
  document.getElementById('sync-badge').style.display = 'none';
  trips = [];
  renderHome();
}

// ═══════════════════════════════════════
// CLOUD STORAGE
// ═══════════════════════════════════════
async function loadTripsFromCloud() {
  if (!supabaseClient || !currentUser) return;
  const { data, error } = await supabaseClient
    .from('trips')
    .select('trip_key, data, updated_at')
    .order('updated_at', { ascending: false });

  if (error) { console.error('載入行程失敗:', error); return; }

  trips = (data && data.length > 0) ? data.map(row => row.data) : [];
  renderHome();
}

async function saveToCloud(trip) {
  if (!supabaseClient || !currentUser) return;
  const { error } = await supabaseClient
    .from('trips')
    .upsert({
      owner_id: currentUser.id,
      trip_key: trip.id,
      data: trip,
    }, { onConflict: 'owner_id,trip_key' });

  if (error) {
    console.error('儲存失敗:', error);
    throw new Error(error.message);
  }
}
window.saveToCloud = saveToCloud;

async function deleteFromCloud(tripId) {
  if (!supabaseClient || !currentUser) return;
  await supabaseClient
    .from('trips')
    .delete()
    .eq('owner_id', currentUser.id)
    .eq('trip_key', tripId);
}

// ═══════════════════════════════════════
// 分享連結
// ═══════════════════════════════════════
let _shareTargetTripId = null;

function openShareModal() {
  if (!currentUser) {
    alert('請先登入 Google 帳號才能建立分享連結');
    return;
  }
  document.getElementById('share-modal').style.display = 'flex';
  document.getElementById('share-link-box').style.display = 'none';
  document.getElementById('collab-status').textContent = '';
  document.getElementById('collab-email').value = '';

  if (currentTrip && supabaseClient) {
    supabaseClient
      .from('trips')
      .select('id')
      .eq('owner_id', currentUser.id)
      .eq('trip_key', currentTrip.id)
      .single()
      .then(({ data }) => { if (data) _shareTargetTripId = data.id; });
  }
}

function closeShareModal() {
  document.getElementById('share-modal').style.display = 'none';
}

// 權限按鈕切換視覺
document.querySelectorAll('input[name="share-perm"]').forEach(radio => {
  radio.addEventListener('change', () => {
    document.querySelectorAll('.share-perm-btn').forEach(btn => {
      const isSelected = btn.dataset.val === radio.value;
      btn.style.background   = isSelected ? 'var(--d1)' : 'white';
      btn.style.color        = isSelected ? 'white' : 'var(--muted)';
      btn.style.borderColor  = isSelected ? 'var(--d1)' : 'var(--border)';
    });
  });
});

async function generateShareLink() {
  if (!supabaseClient || !_shareTargetTripId) {
    alert('請稍候，正在準備行程資料⋯');
    return;
  }
  const perm = document.querySelector('input[name="share-perm"]:checked').value;
  const btn  = document.getElementById('gen-share-btn');
  btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> 產生中⋯';
  btn.disabled  = true;

  const { data, error } = await supabaseClient
    .from('shares')
    .insert({ trip_id: _shareTargetTripId, permission: perm, created_by: currentUser.id })
    .select()
    .single();

  btn.innerHTML = '<i class="fas fa-link"></i> 產生分享連結';
  btn.disabled  = false;

  if (error) { alert('產生失敗：' + error.message); return; }

  const shareUrl = `${window.location.origin}${window.location.pathname}?share=${data.share_token}`;
  document.getElementById('share-link-input').value = shareUrl;
  document.getElementById('share-link-box').style.display = 'block';
}

function copyShareLink() {
  const input = document.getElementById('share-link-input');
  navigator.clipboard.writeText(input.value).then(() => {
    const btn  = event.target.closest('button');
    const orig = btn.innerHTML;
    btn.innerHTML = '✓ 已複製';
    setTimeout(() => btn.innerHTML = orig, 1800);
  });
}

// ═══════════════════════════════════════
// 協作者邀請
// ═══════════════════════════════════════
async function inviteCollaborator() {
  const email  = document.getElementById('collab-email').value.trim();
  const status = document.getElementById('collab-status');
  if (!email || !supabaseClient || !_shareTargetTripId) return;

  status.style.color = 'var(--muted)';
  status.textContent = '查詢用戶中⋯';

  const { data: targetUserId, error } = await supabaseClient
    .rpc('get_user_id_by_email', { p_email: email });

  if (error) {
    status.style.color = 'var(--red)';
    status.textContent = '查詢失敗：' + error.message;
    return;
  }
  if (!targetUserId) {
    status.style.color = 'var(--red)';
    status.textContent = '找不到此 Email 的用戶，請確認對方已用 Google 登入過本系統';
    return;
  }

  const { error: inviteErr } = await supabaseClient
    .from('collaborators')
    .insert({ trip_id: _shareTargetTripId, user_id: targetUserId, role: 'editor', invited_by: currentUser.id });

  if (inviteErr) {
    status.style.color = inviteErr.code === '23505' ? 'var(--orange)' : 'var(--red)';
    status.textContent = inviteErr.code === '23505' ? '此用戶已是協作者' : '邀請失敗：' + inviteErr.message;
  } else {
    status.style.color = 'var(--ok)';
    status.textContent = `✓ 已邀請 ${email}，對方登入後即可編輯`;
    document.getElementById('collab-email').value = '';
  }
}

// ═══════════════════════════════════════
// 分享連結模式（訪客 / 已登入讀取）
// ═══════════════════════════════════════
async function loadSharedTrip(token, loggedIn = false) {
  if (!supabaseClient) return;

  const { data, error } = await supabaseClient.rpc('get_trip_by_share_token', { p_token: token });
  if (error || !data) {
    document.body.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;color:#888;gap:1rem;"><div style="font-size:3rem;">🔒</div><div style="font-size:1.1rem;font-weight:700;color:#333;">連結無效或已過期</div><a href="/" style="color:#4f7ef8;">回到首頁</a></div>';
    return;
  }

  const trip       = data.trip;
  const permission = data.permission;
  trips       = [trip];
  currentTrip = trip;

  if (!loggedIn) {
    document.getElementById('auth-bar').innerHTML = `
      <div style="display:flex;align-items:center;gap:0.6rem;">
        <div style="width:1.8rem;height:1.8rem;border-radius:8px;background:var(--d1);display:flex;align-items:center;justify-content:center;color:white;font-size:0.85rem;"><i class="fas fa-route"></i></div>
        <span style="font-size:0.88rem;font-weight:900;color:var(--ink);">旅行手帖</span>
      </div>
      <div style="display:flex;align-items:center;gap:0.5rem;">
        <span style="font-size:0.72rem;font-weight:700;padding:0.2rem 0.6rem;border-radius:999px;background:var(--warn-bg);color:var(--warn);border:1px solid var(--warn-br);">
          ${permission === 'edit' ? '✏️ 可編輯' : '👁 唯讀'} 分享模式
        </span>
        <a href="${window.location.pathname}" style="font-size:0.72rem;color:var(--d1);font-weight:600;text-decoration:none;">自己登入使用 →</a>
      </div>
    `;
  }

  if (permission === 'view') {
    document.querySelectorAll('[onclick*="openEditor"]').forEach(el => el.style.display = 'none');
  }

  document.getElementById('trip-selector').style.display = 'none';
  showTrip(trip.id);
}

// ═══════════════════════════════════════
// showTrip 擴充：加入分享按鈕 + 航班動態
// ═══════════════════════════════════════
const _origShowTrip = window.showTrip;
window.showTrip = function(id) {
  _origShowTrip(id);
  loadFlightStatus();
  if (currentUser && SUPABASE_ENABLED && !SHARE_TOKEN) {
    const nav = document.querySelector('.detail-nav');
    if (nav && !nav.querySelector('.share-btn')) {
      const shareBtn = document.createElement('button');
      shareBtn.className  = 'btn-ghost share-btn';
      shareBtn.style.cssText = 'font-size:0.75rem;padding:0.4rem 0.8rem;display:flex;align-items:center;gap:0.3rem;';
      shareBtn.innerHTML  = '<i class="fas fa-share-alt"></i> 分享';
      shareBtn.onclick    = openShareModal;
      nav.insertBefore(shareBtn, nav.lastElementChild);
    }
  }
};

// ═══════════════════════════════════════
// 啟動
// ═══════════════════════════════════════

// 調整首頁 padding 避免被 auth-bar 蓋住
if (SUPABASE_ENABLED) {
  const sel = document.getElementById('trip-selector');
  if (sel) sel.style.paddingTop = '6rem';
}

initAuth().then(() => {
  // 未登入或無 Supabase 時，從 localStorage 載入
  if (!SHARE_TOKEN && (!SUPABASE_ENABLED || !currentUser)) {
    trips = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    renderHome();
  }
});
