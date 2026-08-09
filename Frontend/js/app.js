// Frontend/js/app.js — Central Application Entry Point

import { showToast } from './utils.js';
import {
  fetchMoviesApi, fetchUserOrdersApi, fetchGuestCartApi
} from './api.js';
import {
  getCurrentUser, getIsLoggedIn, getSessionId, saveAuthState,
  updateNavAuthUI, toggleAuthModeUI, handleAuthSubmit, handleLogout,
  setIsLoggedIn, setCurrentUser
} from './auth.js';
import {
  getMovies, setMovies, getFavorites, renderMoviesCatalog, startHeroTimer,
  setActiveGenre, setSortBy, closeModal
} from './movies.js';
import {
  setupSearchListeners, openMovieDetailsPage
} from './search.js';
import {
  getCart, setCart, updateCartCounts, renderCartList, handleCheckout
} from './cart.js';
import {
  setLibrary, setUserOrders, renderLibrary
} from './library.js';
import { renderProfile } from './profile.js';
import {
  initVoiceRecognition, toggleVoiceRecognition, processVoiceCommand
} from './voice.js';

export async function loadComponents() {
  const appContainer = document.getElementById('app');
  if (!appContainer) return;

  const componentFiles = [
    'components/navbar.html',
    'components/login.html',
    'components/home.html',
    'components/movie-detail.html',
    'components/library.html',
    'components/cart.html',
    'components/profile.html',
    'components/modals.html',
    'components/footer.html'
  ];

  try {
    const htmlChunks = await Promise.all(
      componentFiles.map(async file => {
        const res = await fetch(file);
        if (!res.ok) throw new Error(`Failed to load component: ${file}`);
        return await res.text();
      })
    );

    appContainer.innerHTML = `
      ${htmlChunks[0]}
      <main id="mainContainer" class="pt-6 sm:pt-10 transition-all duration-300">
        ${htmlChunks[1]}
        ${htmlChunks[2]}
        ${htmlChunks[3]}
        ${htmlChunks[4]}
        ${htmlChunks[5]}
        ${htmlChunks[6]}
      </main>
      ${htmlChunks[7]}
      ${htmlChunks[8]}
    `;
  } catch (err) {
    console.error("Error loading CineVerse HTML components:", err);
  }
}

export function updateCounts() {
  updateCartCounts();
  updateNavAuthUI();
  renderProfile();
}

export function navigate(view) {
  const isLoggedIn = getIsLoggedIn();
  if (!isLoggedIn && view !== 'login') {
    view = 'login';
  }

  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  const targetView = document.getElementById('view-' + view);
  if (targetView) targetView.classList.remove('hidden');

  const mainContainer = document.getElementById('mainContainer');
  const navWrap = document.getElementById('navWrap');

  if (view === 'login' || !isLoggedIn) {
    if (navWrap) {
      navWrap.style.display = 'none';
      navWrap.classList.add('hidden');
    }
    if (mainContainer) {
      mainContainer.style.paddingTop = '24px';
    }
  } else {
    if (navWrap) {
      navWrap.style.display = 'flex';
      navWrap.classList.remove('hidden');
    }
    if (mainContainer) {
      mainContainer.style.paddingTop = '120px';
    }
  }

  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active', 'bg-[#1677FF]', 'text-white', 'shadow-[0_4px_16px_rgba(22,119,255,0.35)]'));
  document.querySelectorAll(`[data-view="${view}"]`).forEach(b => {
    if (b.classList.contains('nav-btn') && b.closest('#navbar')) {
      b.classList.add('active', 'bg-[#1677FF]', 'text-white', 'shadow-[0_4px_16px_rgba(22,119,255,0.35)]');
      b.classList.remove('text-[#C7D0E0]');
    }
  });

  if (view === 'home' && location.hash.startsWith('#movie/')) {
    history.pushState("", document.title, window.location.pathname + window.location.search);
  }

  const footer = document.getElementById('footer');
  if (footer) footer.classList.toggle('hidden', view === 'login');

  window.scrollTo({ top: 0, behavior: 'smooth' });
  const mm = document.getElementById('mobileMenu');
  if (mm) { mm.classList.add('hidden'); mm.classList.remove('flex'); }
}

async function fetchMoviesData() {
  try {
    const loadedMovies = await fetchMoviesApi();
    setMovies(loadedMovies);
  } catch (err) {
    console.warn("Could not fetch movies from backend:", err);
    showToast("Backend offline: Using store cache");
  }
  renderMoviesCatalog(updateCounts);
  if (location.hash.startsWith('#movie/')) {
    const movieId = location.hash.replace('#movie/', '');
    openMovieDetailsPage(movieId, navigate, updateCounts);
  }
}

async function fetchUserOrdersData() {
  const currentUser = getCurrentUser();
  const isLoggedIn = getIsLoggedIn();
  if (!isLoggedIn || !currentUser || !currentUser.user_id) return;
  try {
    const orderData = await fetchUserOrdersApi(currentUser.user_id);
    setUserOrders(orderData);

    const movies = getMovies();
    const ownedMap = new Map();
    orderData.forEach(ord => {
      const items = ord.items || [];
      items.forEach(it => {
        const mId = it.movie_id || it.id;
        const foundMovie = movies.find(x => x.id === mId) || {
          id: mId,
          title: it.name || it.title || 'Purchased Film',
          price: parseFloat(it.price || 0),
          genre: 'Cinema',
          year: 2024,
          rating: 8.0,
          poster: `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600"><rect width="400" height="600" fill="%230b1020"/><text x="200" y="300" font-family="sans-serif" font-size="20" fill="%23fff" text-anchor="middle">CINEVERSE</text></svg>')}`
        };
        ownedMap.set(mId, foundMovie);
      });
    });
    setLibrary(Array.from(ownedMap.values()));
    saveAuthState();
    renderLibrary();
    updateCounts();
  } catch (err) {
    console.error("Error fetching user orders:", err);
  }
}

async function fetchGuestCartData() {
  if (!getIsLoggedIn()) {
    try {
      const sessionItems = await fetchGuestCartApi(getSessionId());
      const movies = getMovies();
      const loadedCart = sessionItems.map(sc => {
        const mId = sc.movie_id;
        return movies.find(m => m.id === mId) || {
          id: mId,
          title: sc.title || sc.MovieName || 'Movie',
          price: parseFloat(sc.price || sc.Price || 499),
          genre: sc.genre || 'Cinema',
          year: 2024,
          rating: 8.0
        };
      });
      setCart(loadedCart);
      updateCounts();
      renderCartList(updateCounts, () => renderMoviesCatalog(updateCounts));
    } catch (e) { console.error("Error fetching guest session cart:", e); }
  }
}

function wireEventListeners() {
  document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => navigate(b.dataset.view)));

  document.getElementById('mobileMenuBtn')?.addEventListener('click', () => {
    const m = document.getElementById('mobileMenu');
    if (m) { m.classList.toggle('hidden'); m.classList.toggle('flex'); }
  });

  document.querySelectorAll('.genre-btn').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('.genre-btn').forEach(x => { x.classList.remove('active', 'bg-[#1677FF]', 'text-white'); x.classList.add('bg-[#10182B]', 'text-[#C7D0E0]', 'border', 'border-white/10'); });
    b.classList.add('active', 'bg-[#1677FF]', 'text-white'); b.classList.remove('bg-[#10182B]', 'border-white/10');
    setActiveGenre(b.dataset.genre);
    renderMoviesCatalog(updateCounts);
  }));

  document.getElementById('sortSelect')?.addEventListener('change', e => {
    setSortBy(e.target.value);
    renderMoviesCatalog(updateCounts);
  });

  document.getElementById('scrollLeft')?.addEventListener('click', () => document.getElementById('featuredRow')?.scrollBy({ left: -320, behavior: 'smooth' }));
  document.getElementById('scrollRight')?.addEventListener('click', () => document.getElementById('featuredRow')?.scrollBy({ left: 320, behavior: 'smooth' }));
  document.getElementById('closeModal')?.addEventListener('click', closeModal);
  document.getElementById('modalBackdrop')?.addEventListener('click', closeModal);
  document.getElementById('ctaExplore')?.addEventListener('click', () => document.getElementById('movieGrid')?.scrollIntoView({ behavior: 'smooth' }));
  document.getElementById('showreelBtn')?.addEventListener('click', () => showToast('TMDB Movie Catalog — Available in 4K HDR'));
  document.getElementById('librarySearch')?.addEventListener('input', renderLibrary);
  document.getElementById('libraryFilter')?.addEventListener('change', renderLibrary);

  document.getElementById('toggleAuthMode')?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleAuthModeUI();
  });

  document.getElementById('togglePass')?.addEventListener('click', () => {
    const inp = document.getElementById('passwordInput');
    if (inp) {
      inp.type = inp.type === 'password' ? 'text' : 'password';
      const icon = document.querySelector('#togglePass i');
      if (icon) icon.className = inp.type === 'password' ? 'ri-eye-line' : 'ri-eye-off-line';
    }
  });

  document.getElementById('loginForm')?.addEventListener('submit', (e) => {
    handleAuthSubmit(e, async () => {
      await fetchUserOrdersData();
      updateCounts();
      navigate('home');
    });
  });

  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await handleLogout(() => {
      setCart([]);
      setLibrary([]);
      setUserOrders([]);
      getFavorites().clear();
      updateCounts();
      navigate('login');
    });
  });

  document.getElementById('checkoutBtn')?.addEventListener('click', () => {
    handleCheckout(navigate, updateCounts, renderLibrary);
  });

  const voicePanel = document.getElementById('voicePanel');
  const closeVoice = () => { if (voicePanel) voicePanel.classList.add('hidden'); };

  document.getElementById('voiceBtn')?.addEventListener('click', () => {
    voicePanel?.classList.toggle('hidden');
    toggleVoiceRecognition();
  });
  document.getElementById('closeVoice')?.addEventListener('click', closeVoice);

  document.querySelectorAll('.voice-phrase').forEach(b => b.addEventListener('click', () => {
    const phrase = b.textContent.replace(/[^a-zA-Z0-9 ]/gi, '').trim();
    closeVoice();
    processVoiceCommand(phrase, navigate, updateCounts);
  }));

  document.getElementById('micAction')?.addEventListener('click', () => {
    toggleVoiceRecognition();
  });

  setupSearchListeners(navigate, updateCounts);
  initVoiceRecognition(navigate, updateCounts);
}

export async function initApp() {
  await loadComponents();
  wireEventListeners();
  startHeroTimer();
  await fetchMoviesData();

  const isLoggedIn = getIsLoggedIn();
  const currentUser = getCurrentUser();

  if (isLoggedIn && currentUser) {
    await fetchUserOrdersData();
    updateCounts();
    navigate('home');
  } else {
    localStorage.removeItem('cv_logged');
    localStorage.removeItem('cv_user');
    setCurrentUser(null);
    setIsLoggedIn(false);
    await fetchGuestCartData();
    updateCounts();
    navigate('login');
  }

  renderCartList(updateCounts, () => renderMoviesCatalog(updateCounts));
  renderLibrary();

  const obs = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) e.target.classList.add('in'); }), { threshold: 0.1 });
  document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
}

// Auto-boot application on DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
