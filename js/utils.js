// ═══════════════════════════════════════
// STATE — 全域共用狀態
// ═══════════════════════════════════════
const STORAGE_KEY = 'travel_planner_trips';
var trips = [];
var currentTrip = null;

// ═══════════════════════════════════════
// SECURITY — XSS 防護
// ═══════════════════════════════════════
window.escapeHTML = function(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[&<>'"]/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[tag]));
};

// ═══════════════════════════════════════
// TOAST — 通知提示
// ═══════════════════════════════════════
function showToast(message, type = 'success') {
  const colors = {
    success: { bg: 'var(--ok-bg)', color: 'var(--ok)', border: 'var(--ok-br)' },
    warn:    { bg: 'var(--warn-bg)', color: 'var(--warn)', border: 'var(--warn-br)' },
    info:    { bg: 'var(--info-bg)', color: 'var(--info)', border: 'var(--info-br)' },
  };
  const c = colors[type] || colors.success;
  const el = document.createElement('div');
  el.style.cssText = `
    background:${c.bg}; color:${c.color}; border:1px solid ${c.border};
    padding:0.7rem 1.1rem; border-radius:10px; font-size:0.82rem; font-weight:600;
    box-shadow:0 4px 12px rgba(0,0,0,0.08);
    animation: toastIn 0.25s ease;
    max-width: 320px;
  `;
  el.textContent = message;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ── 測試環境 export（不影響瀏覽器行為）──
if (typeof module !== 'undefined') {
  module.exports = { STORAGE_KEY, escapeHTML: window.escapeHTML, showToast };
}
