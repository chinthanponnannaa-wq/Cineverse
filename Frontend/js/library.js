// Frontend/js/library.js — Library Vault & Order History

import { formatPrice, getNeutralPlaceholder } from './utils.js';
import { fetchWatchProviders } from './api.js';

let library = [];
let userOrders = [];
let hasLibraryFetchError = false;

export function getLibrary() { return library; }
export function setLibrary(l) { library = l; }

export function getUserOrders() { return userOrders; }
export function setUserOrders(o) {
  userOrders = Array.isArray(o) ? o : [];
  hasLibraryFetchError = false;
  processOrdersToLibrary();
}

export function setLibraryFetchError(isError) {
  hasLibraryFetchError = isError;
}

export function processOrdersToLibrary() {
  const ownedMap = new Map();
  const rentalsMap = new Map();
  let totalSpent = 0.0;

  userOrders.forEach(ord => {
    const status = (ord.order_status || 'placed').toLowerCase();
    if (status !== 'placed' && status !== 'completed' && status !== 'paid') return;

    totalSpent += parseFloat(ord.total_amount || 0);
    const items = ord.items || [];
    const orderDate = ord.order_date || new Date().toISOString();

    items.forEach(it => {
      const mId = parseInt(it.movie_id || it.id);
      if (!mId) return;

      const isRental = it.license_type === 'rental';
      const foundCatalogMovie = getMovies().find(m => m.id === mId);
      const rawImdbRating = it.imdb_rating ?? (foundCatalogMovie ? foundCatalogMovie.imdb_rating : null);
      const rawTmdbRating = it.tmdb_rating ?? (foundCatalogMovie ? foundCatalogMovie.tmdb_rating : null);
      const imdbRating = (rawImdbRating !== null && rawImdbRating !== undefined && !isNaN(rawImdbRating)) ? parseFloat(rawImdbRating) : null;
      const tmdbRating = (rawTmdbRating !== null && rawTmdbRating !== undefined && !isNaN(rawTmdbRating)) ? parseFloat(rawTmdbRating) : 8.0;

      const itemObj = {
        id: mId,
        movie_id: mId,
        tmdb_id: it.tmdb_id || mId,
        imdb_id: it.imdb_id || (foundCatalogMovie ? foundCatalogMovie.imdb_id : null),
        imdb_rating: imdbRating,
        tmdb_rating: tmdbRating,
        title: it.name || it.title || 'Movie License',
        genre: it.genre || 'Cinema',
        price: parseFloat(it.price || 499),
        rental_price: parseFloat(it.rental_price || 149),
        rating: imdbRating ?? tmdbRating,
        poster: it.poster || `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600"><rect width="400" height="600" fill="%230b1020"/><text x="200" y="300" font-family="sans-serif" font-size="20" fill="%23fff" text-anchor="middle">CINEVERSE</text></svg>')}`,
        license_type: isRental ? 'rental' : 'purchase',
        order_date: orderDate
      };

      if (isRental) {
        const purchasedTime = new Date(orderDate).getTime();
        const now = Date.now();
        const hoursElapsed = (now - purchasedTime) / (1000 * 60 * 60);
        if (isNaN(hoursElapsed) || hoursElapsed < 48) {
          rentalsMap.set(mId, itemObj);
        }
      } else {
        ownedMap.set(mId, itemObj);
      }
    });
  });

  const ownedList = Array.from(ownedMap.values());
  const rentalsList = Array.from(rentalsMap.values());

  library = [...ownedList, ...rentalsList];

  const statOwned = document.getElementById('statOwned');
  if (statOwned) statOwned.textContent = ownedList.length;

  const statLicenses = document.getElementById('statLicenses');
  if (statLicenses) statLicenses.textContent = rentalsList.length;

  const statSpent = document.getElementById('statSpent');
  if (statSpent) statSpent.textContent = formatPrice(totalSpent);

  const libCountEl = document.getElementById('libCount');
  if (libCountEl) {
    libCountEl.textContent = library.length;
    libCountEl.classList.toggle('hidden', library.length === 0);
  }

  const emptyEl = document.getElementById('libraryEmpty');
  if (emptyEl) {
    emptyEl.classList.toggle('hidden', library.length > 0 || hasLibraryFetchError);
  }
}

export function renderLibrary() {
  const emptyEl = document.getElementById('emptyLibraryState');
  const grid = document.getElementById('libraryGrid');
  const errEl = document.getElementById('libraryErrorState');

  if (!grid) return;

  if (hasLibraryFetchError) {
    if (emptyEl) emptyEl.classList.add('hidden');
    grid.classList.add('hidden');
    if (errEl) {
      errEl.classList.remove('hidden');
      errEl.innerHTML = `
        <div class="p-8 text-center bg-[#10182B] rounded-3xl border border-white/10 max-w-md mx-auto my-12">
          <i class="ri-wifi-off-line text-4xl text-[#00A8E8] mb-3 block"></i>
          <h3 class="font-black text-white text-lg tracking-tight">Unable to Load Digital Vault</h3>
          <p class="text-xs text-[#8491A7] font-medium mt-1 mb-5">There was a network problem connecting to the license server.</p>
          <button id="retryLibraryBtn" class="bg-[#1677FF] text-white px-6 py-2.5 rounded-full font-black text-xs tracking-widest hover:bg-[#3D8BFF] transition">RETRY CONNECTION</button>
        </div>
      `;
      document.getElementById('retryLibraryBtn')?.addEventListener('click', () => {
        if (window.fetchUserOrdersData) window.fetchUserOrdersData();
      });
      return;
    }
  }

  const librarySearch = document.getElementById('librarySearch');
  const q = librarySearch ? librarySearch.value.toLowerCase() : '';
  let list = [...library];
  if (q) list = list.filter(m => m.title.toLowerCase().includes(q));

  const libraryFilter = document.getElementById('libraryFilter');
  const filter = libraryFilter ? libraryFilter.value : 'RECENTLY ADDED';
  if (filter === 'A-Z') list.sort((a, b) => a.title.localeCompare(b.title));
  if (filter === 'YEAR') list.sort((a, b) => (b.year || 2024) - (a.year || 2024));

  grid.innerHTML = list.map(m => {
    const placeholder = getNeutralPlaceholder(m.title);
    const isRental = m.license_type === 'rental';
    return `
      <div class="bg-[#10182B] rounded-[24px] overflow-hidden border border-white/10 group">
        <div class="relative aspect-[2/3] overflow-hidden">
          <img src="${m.poster}" onerror="this.onerror=null; this.src='${placeholder}';" class="w-full h-full object-cover group-hover:scale-105 transition duration-700">
          <div class="absolute inset-0 bg-gradient-to-t from-[#05070D]/80 to-transparent"></div>
          <div class="absolute bottom-3 left-3 right-3">
            <div class="h-1.5 bg-white/20 rounded-full overflow-hidden"><div class="h-full bg-[#1677FF] w-[100%]"></div></div>
            <div class="text-[10px] font-black tracking-widest text-white mt-1.5">${isRental ? '48H RENTAL LICENSE' : 'PERMANENT LICENSE'}</div>
          </div>
          <div class="absolute top-3 left-3 bg-[#1677FF] text-white text-[10px] font-black px-2 py-1 rounded-full">${isRental ? 'RENTED' : 'OWNED'}</div>
        </div>
        <div class="p-4">
          <div class="font-black text-sm leading-tight text-white">${m.title}</div>
          <div class="text-xs font-medium text-[#8491A7] mt-0.5">${m.genre} • IMDb ${m.imdb_rating ? '★ ' + m.imdb_rating : 'NR'}</div>
          <button data-watch="${m.tmdb_id || m.id}" class="mt-3 w-full bg-[#1677FF] text-white py-2.5 rounded-full font-black text-xs tracking-widest flex items-center justify-center gap-2 hover:bg-[#3D8BFF] transition watch-btn"><i class="ri-external-link-line"></i> WHERE TO WATCH</button>
        </div>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.watch-btn').forEach(b => {
    b.addEventListener('click', () => {
      fetchWatchProviders(b.dataset.watch);
    });
  });

  const hist = document.getElementById('purchaseHistory');
  const noHist = document.getElementById('noHistory');
  if (!hist || !noHist) return;

  if (userOrders.length === 0) {
    hist.innerHTML = '';
    noHist.classList.remove('hidden');
  } else {
    noHist.classList.add('hidden');
    hist.innerHTML = userOrders.map((ord, i) => {
      const items = ord.items || [];
      const itemNames = items.map(it => it.name || it.title).join(', ') || 'Movie License';
      const dateStr = ord.order_date ? new Date(ord.order_date).toLocaleDateString() : new Date(Date.now() - i * 86400000).toLocaleDateString();
      return `
        <div class="flex items-center gap-4 bg-[#10182B] rounded-2xl p-4 border border-white/10 text-white">
          <div class="w-10 h-10 rounded-xl bg-[#1677FF]/20 text-[#00A8E8] border border-[#00A8E8]/30 grid place-items-center font-black text-xs shrink-0"><i class="ri-file-text-line text-lg"></i></div>
          <div class="flex-1 min-w-0">
            <div class="font-black text-sm text-white truncate">${itemNames}</div>
            <div class="text-xs font-medium text-[#8491A7]">Order ${ord.order_id || ord.id} • ${dateStr} • ${ord.payment_method || 'COD'}</div>
          </div>
          <div class="text-right">
            <div class="font-black text-sm text-[#00A8E8]">${formatPrice(ord.total_amount || 0)}</div>
            <span class="inline-block bg-white/5 border border-white/10 px-2.5 py-0.5 rounded-full text-[10px] font-black text-white/80 uppercase">${ord.order_status || 'placed'}</span>
          </div>
        </div>
      `;
    }).join('');
  }
}
