import { formatPrice, getNeutralPlaceholder, resolvePoster, showToast, API_BASE_URL } from './utils.js';
import { fetchWatchProviders, safeFetchJson, apiSearchMovies } from './api.js';
import { getMovies, getFavorites, toggleFav } from './movies.js';
import { getLibrary } from './library.js';
import { getCart, addToCart } from './cart.js';

const movieSearchCache = new Map();

export function closeSearchDropdown() {
  const searchDropdown = document.getElementById('searchDropdown');
  if (searchDropdown) {
    searchDropdown.classList.add('hidden');
    searchDropdown.classList.remove('flex');
  }
}

export async function handleSearchInput(e, navigateFn, onUpdateCounts) {
  const term = e.target.value.trim();
  const searchDropdown = document.getElementById('searchDropdown');
  const searchDropdownList = document.getElementById('searchDropdownList');
  if (!searchDropdown || !searchDropdownList) return;

  if (!term) {
    closeSearchDropdown();
    return;
  }

  // 1. Show local matches instantly
  const movies = getMovies();
  let matches = movies.filter(m => m.title.toLowerCase().includes(term.toLowerCase()));

  if (matches.length > 0) {
    matches.forEach(m => { if (m.id) movieSearchCache.set(String(m.id), m); });
    renderDropdownItems(matches, searchDropdownList, navigateFn, onUpdateCounts);
    searchDropdown.classList.remove('hidden');
    searchDropdown.classList.add('flex');
  }

  // 2. Fetch live TMDB search results from backend API
  try {
    const apiMatches = await apiSearchMovies(term);
    if (apiMatches && apiMatches.length > 0) {
      apiMatches.forEach(m => { if (m.id) movieSearchCache.set(String(m.id), m); });
      renderDropdownItems(apiMatches, searchDropdownList, navigateFn, onUpdateCounts);
      searchDropdown.classList.remove('hidden');
      searchDropdown.classList.add('flex');
    } else if (matches.length === 0) {
      searchDropdownList.innerHTML = `<div class="p-3 text-center text-xs font-bold text-[#8491A7]">No movies found</div>`;
      searchDropdown.classList.remove('hidden');
      searchDropdown.classList.add('flex');
    }
  } catch (err) {
    if (matches.length === 0) {
      searchDropdownList.innerHTML = `<div class="p-3 text-center text-xs font-bold text-[#8491A7]">No movies found</div>`;
      searchDropdown.classList.remove('hidden');
      searchDropdown.classList.add('flex');
    }
  }
}

function renderDropdownItems(list, container, navigateFn, onUpdateCounts) {
  container.innerHTML = list.map(m => {
    const placeholder = getNeutralPlaceholder(m.title);
    return `
      <div class="flex items-center gap-3 p-2 rounded-xl hover:bg-white/10 cursor-pointer transition search-item-row" data-movie-id="${m.id}">
        <img src="${m.poster}" onerror="this.onerror=null; this.src='${placeholder}';" class="w-10 h-14 rounded-lg object-cover bg-[#05070D] shrink-0">
        <div class="flex-1 min-w-0">
          <div class="font-black text-xs text-white truncate">${m.title}</div>
          <div class="text-[10px] font-bold text-[#8491A7] mt-0.5">${m.year || 2024} • ${m.genre}</div>
        </div>
        <span class="bg-[#F5C518]/20 text-[#F5C518] border border-[#F5C518]/30 text-[10px] font-black px-2 py-0.5 rounded-full shrink-0">IMDb ${m.imdb_rating ? '★ ' + m.imdb_rating : 'NR'}</span>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.search-item-row').forEach(row => {
    row.addEventListener('click', () => {
      const mId = row.dataset.movieId;
      const targetMovie = list.find(x => String(x.id) === String(mId)) || mId;
      openMovieDetailsPage(targetMovie, navigateFn, onUpdateCounts);
    });
  });
}

export async function openMovieDetailsPage(movieOrId, navigateFn, onUpdateCounts) {
  let m = null;
  if (typeof movieOrId === 'object' && movieOrId !== null) {
    m = movieOrId;
    if (m.id) movieSearchCache.set(String(m.id), m);
  } else if (movieOrId) {
    const idStr = String(movieOrId);
    m = movieSearchCache.get(idStr) || getMovies().find(x => String(x.id) === idStr || String(x.tmdb_id) === idStr);
    if (!m) {
      try {
        const res = await safeFetchJson(`${API_BASE_URL}/movies/${encodeURIComponent(idStr)}/`);
        if (res.ok && res.data) {
          const raw = res.data;
          const rawR = raw.rating ?? raw.Rating;
          const parsedR = (rawR !== null && rawR !== undefined && !isNaN(rawR)) ? parseFloat(rawR) : 8.0;
          m = {
            id: raw.movie_id || raw.id,
            movie_id: raw.movie_id || raw.id,
            tmdb_id: raw.tmdb_id || raw.movie_id || raw.id,
            title: raw.title || 'Movie Title',
            genre: raw.genre || 'Cinema',
            price: parseFloat(raw.price || 499),
            rental_price: parseFloat(raw.rental_price || 149),
            rating: parsedR,
            description: raw.description || 'No description available.',
            synopsis: raw.description || 'No description available.',
            poster: resolvePoster(raw.poster_image, raw.title),
            backdrop: resolvePoster(raw.backdrop_image || raw.poster_image, raw.title),
            year: 2024
          };
          movieSearchCache.set(String(m.id), m);
        }
      } catch (err) {
        console.warn("Could not fetch single movie details:", err);
      }
    }
  }

  if (!m) return;

  closeSearchDropdown();
  const sInput = document.getElementById('searchInput');
  if (sInput) sInput.value = '';

  const library = getLibrary();
  const favorites = getFavorites();
  const isOwned = library.some(l => l.id === m.id);
  const placeholder = getNeutralPlaceholder(m.title);
  const container = document.getElementById('movieDetailPageContent');

  if (container) {
    container.innerHTML = `
      <div class="relative h-[360px] sm:h-[420px] overflow-hidden bg-[#05070D]">
        <img src="${m.backdrop}" onerror="this.onerror=null; this.src='${placeholder}';" class="w-full h-full object-cover">
        <div class="absolute inset-0 bg-gradient-to-t from-[#0B1020] via-[#0B1020]/50 to-transparent"></div>
        <div class="absolute inset-0 bg-gradient-to-r from-[#05070D]/80 via-transparent to-transparent"></div>
        <div class="absolute bottom-0 left-0 right-0 p-6 sm:p-10 flex gap-6 items-end">
          <img src="${m.poster}" onerror="this.onerror=null; this.src='${placeholder}';" class="w-32 sm:w-44 h-48 sm:h-64 rounded-2xl object-cover shadow-2xl border-2 border-white/20 hidden sm:block shrink-0">
          <div class="flex-1 min-w-0 pb-2">
            <div class="inline-flex items-center gap-2 bg-[#1677FF] text-white text-[10px] font-black tracking-widest px-3 py-1.5 rounded-full">IMDb ${m.imdb_rating ? '★ ' + m.imdb_rating : 'NR'} • ${m.year || 2024} • TMDB ID: ${m.tmdb_id || m.id}</div>
            <h1 class="text-3xl sm:text-5xl font-black tracking-tighter text-white drop-shadow-lg mt-3">${m.title}</h1>
            <div class="text-[#C7D0E0] text-xs font-bold tracking-widest mt-1.5">${m.genre.toUpperCase()} • DIGITAL LICENSE PLATFORM</div>
          </div>
        </div>
      </div>
      <div class="p-6 sm:p-10">
        <div class="flex flex-wrap gap-3">
          ${isOwned ? `<button onclick="showToast('Digital license active in your CineVerse vault ✓')" class="flex-1 min-w-[180px] bg-[#1677FF] text-white py-4 rounded-full font-black tracking-widest flex items-center justify-center gap-2 hover:bg-[#3D8BFF] transition"><i class="ri-shield-check-line text-xl"></i> LICENSE OWNED ✓</button>` : `
            <button id="pageBuy" class="flex-1 min-w-[160px] bg-[#1677FF] text-white py-4 rounded-full font-black tracking-widest flex items-center justify-center gap-2 hover:bg-[#3D8BFF] transition">BUY — ${formatPrice(m.price)} <i class="ri-shopping-bag-line"></i></button>
            <button id="pageRent" class="flex-1 min-w-[160px] bg-white/10 border border-white/20 text-white py-4 rounded-full font-black tracking-widest flex items-center justify-center gap-2 hover:bg-white/20 transition">RENT 48H — ${formatPrice(m.rental_price)} <i class="ri-time-line"></i></button>
          `}
          <button id="pageFav" class="px-6 py-4 rounded-full border border-white/15 bg-white/5 font-black text-xs tracking-widest flex items-center gap-2 hover:bg-white/10 text-white transition"><i class="${favorites.has(m.id) ? 'ri-heart-3-fill text-[#00A8E8]' : 'ri-heart-3-line'}"></i> ${favorites.has(m.id) ? 'SAVED' : 'SAVE'}</button>
          <button id="pageShare" class="px-6 py-4 rounded-full border border-white/15 bg-white/5 font-black text-xs tracking-widest flex items-center gap-2 hover:bg-white/10 text-white transition"><i class="ri-share-line"></i> SHARE</button>
        </div>
        <div class="grid lg:grid-cols-3 gap-8 mt-10">
          <div class="lg:col-span-2">
            <h3 class="font-black tracking-tighter text-xl text-white">TMDB OVERVIEW</h3>
            <p class="text-sm leading-7 font-medium text-[#C7D0E0] mt-3">${m.synopsis || m.description} Own or rent this digital movie license on CineVerse. View on supported partner devices (Apple TV, Google TV, Prime Video, Movies Anywhere).</p>
            <div class="mt-6 flex flex-wrap gap-2">
              <span class="bg-white/5 border border-white/10 px-3.5 py-2 rounded-full text-xs font-bold text-white/80">4K HDR</span>
              <span class="bg-white/5 border border-white/10 px-3.5 py-2 rounded-full text-xs font-bold text-white/80">DOLBY ATMOS</span>
              <span class="bg-white/5 border border-white/10 px-3.5 py-2 rounded-full text-xs font-bold text-[#00A8E8]">TMDB METADATA</span>
            </div>
            <button id="pageWatchProviders" class="mt-6 bg-[#1677FF] text-white px-6 py-3.5 rounded-full font-black text-xs tracking-widest flex items-center gap-2 hover:bg-[#3D8BFF] transition"><i class="ri-external-link-line"></i> WHERE TO WATCH</button>
          </div>
          <div class="bg-[#10182B] rounded-3xl border border-white/10 p-6">
            <div class="font-black text-base text-white">COMMERCE DETAILS</div>
            <div class="mt-5 space-y-3 text-xs font-medium text-[#C7D0E0]">
              <div class="flex justify-between"><span class="text-[#8491A7]">Genre</span><span class="font-bold text-white">${m.genre}</span></div>
              <div class="flex justify-between"><span class="text-[#8491A7]">Buy Price</span><span class="font-bold text-[#00A8E8]">${formatPrice(m.price)}</span></div>
              <div class="flex justify-between"><span class="text-[#8491A7]">Rent Price</span><span class="font-bold text-white">${formatPrice(m.rental_price)}</span></div>
              <div class="flex justify-between"><span class="text-[#8491A7]">IMDb Rating</span><span class="font-bold text-[#F5C518]">${m.imdb_rating ? '★ ' + m.imdb_rating + '/10' : 'IMDb NR'}</span></div>
              <div class="flex justify-between"><span class="text-[#8491A7]">TMDB Rating</span><span class="font-bold text-white">${m.tmdb_rating ? '★ ' + m.tmdb_rating + '/10' : 'TMDB NR'}</span></div>
              ${m.imdb_id ? `<a href="https://www.imdb.com/title/${m.imdb_id}/" target="_blank" rel="noopener noreferrer" class="mt-4 w-full inline-flex items-center justify-center gap-2 bg-[#F5C518] text-black py-2.5 rounded-full font-black text-xs tracking-widest hover:bg-[#F5C518]/80 transition"><i class="ri-external-link-line"></i> VIEW ON IMDb</a>` : ''}
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('pageFav')?.addEventListener('click', () => { toggleFav(m.id, onUpdateCounts); openMovieDetailsPage(m.id, navigateFn, onUpdateCounts); });
    document.getElementById('pageBuy')?.addEventListener('click', () => { addToCart(m, 'purchase', onUpdateCounts); });
    document.getElementById('pageRent')?.addEventListener('click', () => { addToCart(m, 'rental', onUpdateCounts); });
    document.getElementById('pageShare')?.addEventListener('click', () => { navigator.clipboard.writeText(window.location.href); showToast('Link copied to clipboard ✓'); });
    document.getElementById('pageWatchProviders')?.addEventListener('click', () => { fetchWatchProviders(m.tmdb_id || m.id); });
  }

  location.hash = `#movie/${m.id}`;
  if (navigateFn) navigateFn('movie-detail');
}

export function setupSearchListeners(navigateFn, onUpdateCounts) {
  const sInput = document.getElementById('searchInput');
  sInput?.addEventListener('input', e => handleSearchInput(e, navigateFn, onUpdateCounts));
  sInput?.addEventListener('focus', e => { if (e.target.value.trim()) handleSearchInput(e, navigateFn, onUpdateCounts); });

  document.addEventListener('click', e => {
    if (!e.target.closest('#navSearchContainer')) {
      closeSearchDropdown();
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeSearchDropdown();
      if (sInput) sInput.blur();
    }
  });

  window.addEventListener('hashchange', () => {
    const hash = location.hash;
    if (hash.startsWith('#movie/')) {
      const movieId = hash.replace('#movie/', '');
      openMovieDetailsPage(movieId, navigateFn, onUpdateCounts);
    } else if (hash === '#home' || hash === '' || hash === '#discover') {
      if (navigateFn) navigateFn('home');
    }
  });
}
