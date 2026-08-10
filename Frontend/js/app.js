// Frontend/js/app.js — Central Application Entry Point

console.log("CINEVERSE MODULE EVALUATION START");

import { showToast } from './utils.js';
import {
  fetchMoviesApi, fetchUserOrdersApi, fetchGuestCartApi, apiLogin
} from './api.js';
import {
  getCurrentUser, getIsLoggedIn, getSessionId, saveAuthState,
  updateNavAuthUI, toggleAuthModeUI, handleAuthSubmit, handleLogout,
  setIsLoggedIn, setCurrentUser
} from './auth.js';
import {
  getMovies, setMovies, getFavorites, renderMoviesCatalog, startHeroTimer,
  setActiveGenre, setSortBy, closeModal, openModal, fetchAndRenderCatalog, renderMoviesCatalogError
} from './movies.js';
import {
  setupSearchListeners, openMovieDetailsPage, closeSearchDropdown
} from './search.js';
import { getCart, setCart, updateCartCounts, renderCartList, handleCheckout, addToCart, removeFromCart } from './cart.js';
import { getLibrary, setLibrary, setUserOrders, renderLibrary, setLibraryFetchError } from './library.js';
import { renderProfile } from './profile.js';
import { initVoiceRecognition, toggleVoiceRecognition, processVoiceCommand } from './voice.js';
import { apiCreateOrder, apiVerifyPayment } from './api.js';

// Expose global window bindings for UI events and automation
window.getCurrentUser = getCurrentUser;
window.setCurrentUser = setCurrentUser;
window.getIsLoggedIn = getIsLoggedIn;
window.setIsLoggedIn = setIsLoggedIn;
window.saveAuthState = saveAuthState;
window.apiLogin = apiLogin;
window.fetchUserOrdersData = fetchUserOrdersData;
window.fetchMoviesData = fetchMoviesData;
window.fetchAndRenderCatalog = fetchAndRenderCatalog;
window.renderMoviesCatalogError = () => renderMoviesCatalogError(updateCounts);
window.setActiveGenre = (g) => setActiveGenre(g);
window.setSortBy = (s) => setSortBy(s);
window.renderMoviesCatalog = () => renderMoviesCatalog(updateCounts);
window.openModal = (m) => openModal(m, updateCounts);
window.getMovies = getMovies;
window.getCart = getCart;
window.getLibrary = getLibrary;
window.addToCart = async (m, type) => { await addToCart(m, type, updateCounts); };
window.handleCheckout = () => handleCheckout(navigate, updateCounts, renderLibrary);
window.navigate = navigate;
window.updateCounts = updateCounts;
window.setLibraryFetchError = setLibraryFetchError;
window.renderLibrary = renderLibrary;
window.apiCreateOrder = apiCreateOrder;
window.apiVerifyPayment = apiVerifyPayment;
window.handleLogout = (cb) => handleLogout(cb || (() => { setCart([]); setLibrary([]); setUserOrders([]); getFavorites().clear(); updateCounts(); navigate('login'); }));
window.openMovieDetailsPage = (m) => openMovieDetailsPage(m, navigate, updateCounts);
window.closeSearchDropdown = closeSearchDropdown;

export async function loadComponents() {
  console.log("LOAD COMPONENTS START");
  const appContainer = document.getElementById('app');
  if (!appContainer) return;

  const componentFiles = [
    './components/navbar.html',
    './components/login.html',
    './components/home.html',
    './components/movie-detail.html',
    './components/library.html',
    './components/cart.html',
    './components/profile.html',
    './components/modals.html',
    './components/footer.html'
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
    console.log("LOAD COMPONENTS COMPLETE");
  } catch (err) {
    console.error("Error loading CineVerse HTML components:", err);
    if (appContainer) {
      appContainer.innerHTML = `
        <div class="min-h-screen grid place-items-center bg-[#05070D] text-white p-6 text-center">
          <div class="max-w-md bg-[#0B1020] p-8 rounded-3xl border border-white/10 shadow-2xl">
            <div class="w-12 h-12 rounded-full bg-[#1677FF] text-white grid place-items-center text-2xl font-black mx-auto mb-4">◐</div>
            <h2 class="text-2xl font-black tracking-tight text-white mb-2">CINEVERSE</h2>
            <p class="text-sm text-[#C7D0E0] mb-6">Unable to load application components. Please ensure the server is serving Frontend at http://127.0.0.1:5500.</p>
            <button onclick="window.location.reload()" class="bg-[#1677FF] text-white px-6 py-3 rounded-full text-xs font-black tracking-widest hover:bg-[#3D8BFF] transition">RELOAD CINEVERSE</button>
          </div>
        </div>
      `;
    }
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

  if (view === 'library' || view === 'profile') {
    fetchUserOrdersData();
  }

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
    saveAuthState();
    renderLibrary();
    updateCounts();
  } catch (err) {
    console.error("Error fetching user orders:", err);
    setLibraryFetchError(true);
    renderLibrary();
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

  document.querySelectorAll('.genre-btn').forEach(b => b.addEventListener('click', async () => {
    document.querySelectorAll('.genre-btn').forEach(x => { x.classList.remove('active', 'bg-[#1677FF]', 'text-white'); x.classList.add('bg-[#10182B]', 'text-[#C7D0E0]', 'border', 'border-white/10'); });
    b.classList.add('active', 'bg-[#1677FF]', 'text-white'); b.classList.remove('bg-[#10182B]', 'border-white/10');
    setActiveGenre(b.dataset.genre || 'All');
    await fetchAndRenderCatalog({ append: false, onUpdateCounts: updateCounts });
  }));

  document.getElementById('sortSelect')?.addEventListener('change', async e => {
    setSortBy(e.target.value);
    await fetchAndRenderCatalog({ append: false, onUpdateCounts: updateCounts });
  });

  document.getElementById('loadMoreBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('loadMoreBtn');
    if (btn) btn.innerHTML = 'LOADING MOVIES... <i class="ri-loader-4-line animate-spin"></i>';
    await fetchAndRenderCatalog({ append: true, onUpdateCounts: updateCounts });
    if (btn) btn.innerHTML = 'LOAD MORE MOVIES <i class="ri-arrow-down-line group-hover:translate-y-1 transition"></i>';
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
  console.log("INIT APP START");
  await loadComponents();
  wireEventListeners();
  startHeroTimer();

  const isLoggedIn = getIsLoggedIn();
  const currentUser = getCurrentUser();

  // Immediately render the view shell and counts so page UI displays instantly
  updateCounts();
  const targetView = (isLoggedIn && currentUser && currentUser.user_id) ? 'home' : 'login';
  console.log("NAVIGATING TO INITIAL VIEW:", targetView);
  navigate(targetView);

  // Fetch remote data safely without blocking initial view transition
  try {
    if (isLoggedIn && currentUser && currentUser.user_id) {
      await Promise.all([fetchMoviesData(), fetchUserOrdersData()]);
    } else {
      await Promise.all([fetchMoviesData(), fetchGuestCartData()]);
    }
  } catch (err) {
    console.error("Data fetch error during app initialization:", err);
  }

  updateCounts();
  renderCartList(updateCounts, () => renderMoviesCatalog(updateCounts));
  renderLibrary();

  const obs = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) e.target.classList.add('in'); }), { threshold: 0.1 });
  document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
  console.log("INIT APP COMPLETE");
}

// Auto-boot application on DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
