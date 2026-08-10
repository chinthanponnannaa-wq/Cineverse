// Frontend/js/auth.js — Authentication State & Handlers

import { getInitialsAvatar, showToast } from './utils.js';
import { apiSignup, apiLogin, apiLogout, transferGuestCartToUser } from './api.js';

let currentUser = JSON.parse(localStorage.getItem('cv_user') || 'null');
let isLoggedIn = Boolean(currentUser && localStorage.getItem('cv_logged') === '1');
let authMode = 'login'; // 'login' or 'signup'

let sessionId = localStorage.getItem('cv_session_id');
if (!sessionId) {
  sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
  localStorage.setItem('cv_session_id', sessionId);
}

export function getCurrentUser() { return currentUser; }
export function setCurrentUser(u) { currentUser = u; }

export function getIsLoggedIn() { return isLoggedIn; }
export function setIsLoggedIn(val) { isLoggedIn = val; }

export function getAuthMode() { return authMode; }
export function setAuthMode(mode) { authMode = mode; }

export function getSessionId() { return sessionId; }

export function saveAuthState() {
  localStorage.setItem('cv_logged', isLoggedIn ? '1' : '0');
  if (currentUser) {
    localStorage.setItem('cv_user', JSON.stringify(currentUser));
  } else {
    localStorage.removeItem('cv_user');
  }
}

export function updateNavAuthUI() {
  const loginBtn = document.getElementById('loginBtn');
  const navProfileBtn = document.getElementById('navProfileBtn');
  const navAvatarImg = document.getElementById('navAvatarImg');

  const avatarUrl = getInitialsAvatar();

  if (isLoggedIn && currentUser) {
    if (loginBtn) {
      loginBtn.style.display = 'none';
      loginBtn.classList.add('hidden');
    }
    if (navProfileBtn) {
      navProfileBtn.style.display = 'grid';
      navProfileBtn.classList.remove('hidden');
    }
    if (navAvatarImg) {
      navAvatarImg.src = avatarUrl;
      navAvatarImg.classList.remove('hidden');
    }
    const pName = document.getElementById('profileName');
    if (pName) pName.textContent = currentUser.name.toUpperCase();

    const pSub = document.getElementById('profileSub');
    if (pSub) pSub.textContent = `MEMBER SINCE 2026 • ${currentUser.email.toUpperCase()}`;

    const pAvatar = document.getElementById('profileAvatar');
    if (pAvatar) pAvatar.src = avatarUrl;
  } else {
    if (loginBtn) {
      loginBtn.style.display = 'inline-flex';
      loginBtn.classList.remove('hidden');
    }
    if (navProfileBtn) {
      navProfileBtn.style.display = 'none';
      navProfileBtn.classList.add('hidden');
    }

    const pName = document.getElementById('profileName');
    if (pName) pName.textContent = 'GUEST ACCOUNT';

    const pSub = document.getElementById('profileSub');
    if (pSub) pSub.textContent = 'NOT SIGNED IN — PLEASE SIGN IN TO ACCESS VAULT';

    const pAvatar = document.getElementById('profileAvatar');
    if (pAvatar) pAvatar.src = avatarUrl;
  }
}

export function toggleAuthModeUI() {
  authMode = authMode === 'login' ? 'signup' : 'login';
  const titleEl = document.getElementById('authTitle');
  const subEl = document.getElementById('authSubtitle');
  const nameFld = document.getElementById('nameField');
  const btnEl = document.getElementById('authSubmitBtn');
  const labelEl = document.getElementById('authToggleLabel');
  const toggleAuthModeBtn = document.getElementById('toggleAuthMode');

  if (authMode === 'signup') {
    if (titleEl) titleEl.textContent = 'Create your CineVerse Account';
    if (subEl) subEl.textContent = 'Sign up to build your private movie vault.';
    if (nameFld) nameFld.classList.remove('hidden');
    if (btnEl) btnEl.innerHTML = 'CREATE ACCOUNT <i class="ri-arrow-right-line"></i>';
    if (labelEl) labelEl.textContent = 'Already have an account?';
    if (toggleAuthModeBtn) toggleAuthModeBtn.textContent = 'Sign in here.';
  } else {
    if (titleEl) titleEl.textContent = 'Sign in to CineVerse';
    if (subEl) subEl.textContent = 'Enter your details to access your private movie vault.';
    if (nameFld) nameFld.classList.add('hidden');
    if (btnEl) btnEl.innerHTML = 'SIGN IN <i class="ri-arrow-right-line"></i>';
    if (labelEl) labelEl.textContent = 'No account?';
    if (toggleAuthModeBtn) toggleAuthModeBtn.textContent = 'Create one — start owning.';
  }
}

export async function handleAuthSubmit(e, onSuccess) {
  e.preventDefault();
  const email = document.getElementById('emailInput').value.trim().toLowerCase();
  const pass = document.getElementById('passwordInput').value;
  const name = document.getElementById('nameInput')?.value.trim();

  let valid = true;
  if (!email.includes('@') || !email.includes('.')) {
    document.getElementById('emailError')?.classList.remove('hidden');
    valid = false;
  } else document.getElementById('emailError')?.classList.add('hidden');

  if (pass.length < 6) {
    document.getElementById('passError')?.classList.remove('hidden');
    valid = false;
  } else document.getElementById('passError')?.classList.add('hidden');

  if (authMode === 'signup' && !name) {
    document.getElementById('nameError')?.classList.remove('hidden');
    valid = false;
  } else document.getElementById('nameError')?.classList.add('hidden');

  if (!valid) return;

  const submitBtn = document.getElementById('authSubmitBtn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = (authMode === 'signup' ? 'CREATING ACCOUNT... ' : 'SIGNING IN... ') + '<i class="ri-loader-4-line animate-spin"></i>';
  }

  const resetBtn = () => {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = authMode === 'signup' ? 'CREATE ACCOUNT <i class="ri-arrow-right-line"></i>' : 'SIGN IN <i class="ri-arrow-right-line"></i>';
    }
  };

  if (authMode === 'signup') {
    try {
      const data = await apiSignup(name, email, pass);
      if (data && data.success) {
        currentUser = data.user;
        isLoggedIn = true;
        saveAuthState();
        await transferGuestCartToUser(sessionId);
        showToast('Account created — Welcome ' + currentUser.name + ' ✓');
        resetBtn();
        if (onSuccess) await onSuccess();
      } else {
        showToast(data?.error || 'Signup failed');
        resetBtn();
      }
    } catch (err) {
      showToast('Network error during signup');
      resetBtn();
    }
  } else {
    try {
      const data = await apiLogin(email, pass);
      if (data && data.success) {
        currentUser = data.user;
        isLoggedIn = true;
        saveAuthState();
        await transferGuestCartToUser(sessionId);
        showToast('Welcome back, ' + currentUser.name + ' ✓');
        resetBtn();
        if (onSuccess) await onSuccess();
      } else {
        showToast(data?.error || 'Invalid email or password');
        resetBtn();
      }
    } catch (err) {
      showToast('Network error during sign in');
      resetBtn();
    }
  }
}

export async function handleLogout(onLogoutComplete) {
  if (currentUser && currentUser.user_id) {
    await apiLogout(currentUser.user_id);
  }
  currentUser = null;
  isLoggedIn = false;
  localStorage.removeItem('cv_user');
  localStorage.removeItem('cv_logged');
  localStorage.removeItem('cv_favs');
  localStorage.removeItem('cv_cart');

  const emailInp = document.getElementById('emailInput');
  const passInp = document.getElementById('passwordInput');
  const nameInp = document.getElementById('nameInput');
  if (emailInp) emailInp.value = '';
  if (passInp) passInp.value = '';
  if (nameInp) nameInp.value = '';

  updateNavAuthUI();
  showToast('Signed out successfully');
  if (onLogoutComplete) onLogoutComplete();
}
