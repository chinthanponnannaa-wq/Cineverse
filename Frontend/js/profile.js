// Frontend/js/profile.js — Profile View & User Stats

import { formatPrice, getInitialsAvatar } from './utils.js';
import { getCurrentUser, getIsLoggedIn } from './auth.js';
import { getLibrary, getUserOrders } from './library.js';

export function renderProfile() {
  const library = getLibrary();
  const userOrders = getUserOrders();
  const currentUser = getCurrentUser();
  const isLoggedIn = getIsLoggedIn();

  const libCountEl = document.getElementById('libCount');
  if (libCountEl) {
    libCountEl.textContent = library.length;
    libCountEl.classList.toggle('hidden', library.length === 0);
  }

  const statOwned = document.getElementById('statOwned');
  if (statOwned) statOwned.textContent = library.length;

  const statLicenses = document.getElementById('statLicenses');
  if (statLicenses) statLicenses.textContent = library.length;

  const profileOwned = document.getElementById('profileOwned');
  if (profileOwned) profileOwned.textContent = library.length;

  const profileLicenses = document.getElementById('profileLicenses');
  if (profileLicenses) profileLicenses.textContent = library.length;

  const spent = library.reduce((s, m) => s + (m.purchase_price || m.price || 0), 0);
  const statSpent = document.getElementById('statSpent');
  if (statSpent) statSpent.textContent = formatPrice(spent);

  const profileSpent = document.getElementById('profileSpent');
  if (profileSpent) profileSpent.textContent = formatPrice(spent);

  const customImg = currentUser ? (currentUser.profile_image || currentUser.avatar_url || currentUser.avatar) : null;
  const avatarUrl = getInitialsAvatar(currentUser ? currentUser.name : '', customImg);
  const pName = document.getElementById('profileName');
  const pSub = document.getElementById('profileSub');
  const pAvatar = document.getElementById('profileAvatar');

  if (isLoggedIn && currentUser) {
    if (pName) pName.textContent = currentUser.name.toUpperCase();
    if (pSub) pSub.textContent = `MEMBER SINCE 2026 • ${currentUser.email.toUpperCase()}`;
    if (pAvatar) {
      pAvatar.src = avatarUrl;
      pAvatar.onerror = function() {
        this.onerror = null;
        this.src = getInitialsAvatar();
      };
    }
  } else {
    if (pName) pName.textContent = 'GUEST ACCOUNT';
    if (pSub) pSub.textContent = 'NOT SIGNED IN — PLEASE SIGN IN TO ACCESS VAULT';
    if (pAvatar) {
      pAvatar.src = avatarUrl;
      pAvatar.onerror = function() {
        this.onerror = null;
        this.src = getInitialsAvatar();
      };
    }
  }
}
