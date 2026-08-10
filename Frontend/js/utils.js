// Frontend/js/utils.js — Utility Helpers

export const API_BASE_URL = "http://127.0.0.1:8000";

export function formatPrice(p) {
  const val = typeof p === 'number' ? p : parseFloat(p || 0);
  return '₹' + val.toFixed(2);
}

// UNIVERSAL USER SILHOUETTE AVATAR (Vector SVG matching user reference outline)
export function getInitialsAvatar(name, customAvatar) {
  if (customAvatar && typeof customAvatar === 'string' && (customAvatar.startsWith('http://') || customAvatar.startsWith('https://') || customAvatar.startsWith('data:'))) {
    return customAvatar;
  }
  const userSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
    <rect width="120" height="120" fill="#10182B" rx="60"/>
    <circle cx="60" cy="42" r="22" fill="none" stroke="#00A8E8" stroke-width="6"/>
    <path d="M 22 100 C 22 70, 38 64, 60 64 C 82 64, 98 70, 98 100" fill="none" stroke="#00A8E8" stroke-width="6" stroke-linecap="round"/>
  </svg>`;

  let base64Svg = '';
  if (typeof btoa === 'function') {
    base64Svg = btoa(userSvg);
  } else if (typeof Buffer !== 'undefined') {
    base64Svg = Buffer.from(userSvg).toString('base64');
  } else {
    return `data:image/svg+xml;utf8,${encodeURIComponent(userSvg)}`;
  }
  return `data:image/svg+xml;base64,${base64Svg}`;
}

// CLEAN SVG NEUTRAL PLACEHOLDER (URI Encoded to prevent double-quote HTML leakage)
export function getNeutralPlaceholder(title) {
  const encodedTitle = (title || 'CineVerse Film').replace(/[^a-zA-Z0-9 ]/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600">
    <rect width="400" height="600" fill="%230b1020"/>
    <rect x="20" y="20" width="360" height="560" rx="16" fill="%2310182b" stroke="%231677ff" stroke-width="2" stroke-opacity="0.3"/>
    <circle cx="200" cy="240" r="48" fill="%231677ff" fill-opacity="0.2"/>
    <text x="200" y="250" font-family="sans-serif" font-size="40" font-weight="900" fill="%2300a8e8" text-anchor="middle">◐</text>
    <text x="200" y="340" font-family="sans-serif" font-size="20" font-weight="800" fill="%23ffffff" text-anchor="middle">${encodedTitle}</text>
    <text x="200" y="380" font-family="sans-serif" font-size="12" font-weight="700" fill="%238491a7" text-anchor="middle">CINEVERSE 4K HDR</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function resolvePoster(imgStr, title) {
  if (!imgStr || imgStr === 'null' || imgStr === 'undefined') return getNeutralPlaceholder(title);
  if (imgStr.startsWith('http://') || imgStr.startsWith('https://') || imgStr.startsWith('data:')) {
    return imgStr;
  }
  if (imgStr.startsWith('/')) {
    return `https://image.tmdb.org/t/p/w500${imgStr}`;
  }
  return `${API_BASE_URL}/static/images/${imgStr}`;
}

export function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  const msgEl = document.getElementById('toastMsg');
  if (msgEl) msgEl.textContent = msg;
  t.classList.remove('hidden');
  t.classList.add('flex');
  setTimeout(() => {
    t.classList.add('hidden');
    t.classList.remove('flex');
  }, 2500);
}
