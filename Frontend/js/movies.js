// Frontend/js/movies.js — Movie Catalog, Hero Stack, & Details Modal

import { formatPrice, getNeutralPlaceholder, resolvePoster, showToast } from './utils.js';
import { fetchMoviesApi } from './api.js';
import { getCart, addToCart } from './cart.js';
import { getLibrary } from './library.js';

let movies = [];
let favorites = new Set(JSON.parse(localStorage.getItem('cv_favs') || '[]'));
let activeGenre = 'All';
let sortBy = 'featured';
let heroCarouselIndex = 0;

export function getMovies() { return movies; }
export function setMovies(m) { movies = m; }

export function getFavorites() { return favorites; }
export function getActiveGenre() { return activeGenre; }
export function setActiveGenre(g) { activeGenre = g; }

export function getSortBy() { return sortBy; }
export function setSortBy(s) { sortBy = s; }

export function saveFavorites() {
  localStorage.setItem('cv_favs', JSON.stringify([...favorites]));
}

export function movieCard(m) {
  const isFav = favorites.has(m.id);
  const cart = getCart();
  const library = getLibrary();
  const inCart = cart.some(c => c.id === m.id);
  const owned = library.some(l => l.id === m.id);
  const placeholder = getNeutralPlaceholder(m.title);

  return `<div class="movie-card group bg-[#10182B] rounded-[24px] overflow-hidden border border-white/10 hover:shadow-[0_20px_50px_rgba(0,0,0,0.8)] hover:border-[#1677FF]/50 transition duration-500 cursor-pointer flex flex-col" data-id="${m.id}">
    <div class="relative aspect-[2/3] overflow-hidden bg-[#05070D]">
      <img src="${m.poster}" alt="${m.title}" loading="lazy" onerror="this.onerror=null; this.src='${placeholder}';" class="w-full h-full object-cover group-hover:scale-[1.06] transition duration-[700ms]">
      <div class="absolute inset-0 bg-gradient-to-t from-[#05070D]/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition"></div>
      <div class="absolute top-3 left-3 flex items-center gap-1.5">
        <span class="bg-black/70 backdrop-blur border border-white/10 text-white text-[10px] font-black px-2.5 py-1 rounded-full">${m.year || 2024}</span>
        <span class="bg-[#1677FF] text-white text-[10px] font-black px-2 py-1 rounded-full flex items-center gap-1"><i class="ri-star-fill text-[11px]"></i> ${m.rating}</span>
      </div>
      <button class="fav-btn absolute top-3 right-3 w-8 h-8 rounded-full ${isFav ? 'bg-[#1677FF] text-white' : 'bg-black/60 text-white/80 backdrop-blur border border-white/10'} grid place-items-center hover:scale-110 transition" data-fav="${m.id}"><i class="${isFav ? 'ri-heart-3-fill' : 'ri-heart-3-line'}"></i></button>
      <div class="absolute bottom-3 left-3 right-3 flex gap-2 translate-y-3 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition duration-300">
        <button class="details-btn flex-1 bg-white/10 backdrop-blur border border-white/15 text-white text-[11px] font-black tracking-widest py-2.5 rounded-full hover:bg-white hover:text-black transition">DETAILS</button>
        ${owned ? `<span class="flex-1 bg-[#10182B] text-[#00A8E8] border border-[#00A8E8]/30 text-[11px] font-black tracking-widest py-2.5 rounded-full grid place-items-center">OWNED ✓</span>` : `<button class="cart-btn flex-1 ${inCart ? 'bg-white/20 text-white' : 'bg-[#1677FF] text-white'} text-[11px] font-black tracking-widest py-2.5 rounded-full hover:bg-[#3D8BFF] transition">${inCart ? 'IN CART' : ' + CART'}</button>`}
      </div>
      ${m.trending ? `<div class="absolute left-3 bottom-3 group-hover:opacity-0 transition bg-[#05070D]/90 border border-white/10 text-white text-[9px] font-black tracking-widest px-2.5 py-1 rounded-full flex items-center gap-1"><span class="w-1.5 h-1.5 bg-[#00A8E8] rounded-full animate-pulse"></span> TMDB TOP</div>` : ''}
    </div>
    <div class="p-4 flex-1 flex flex-col">
      <div class="font-black text-[13px] leading-tight tracking-tight line-clamp-1 text-white">${m.title}</div>
      <div class="text-[11px] font-bold tracking-wide text-[#8491A7] mt-1">${m.genre} • Rent ${formatPrice(m.rental_price)}</div>
      <div class="flex items-center justify-between mt-3">
        <span class="font-black text-[16px] tracking-tighter text-white">${formatPrice(m.price)}</span>
        <span class="text-[10px] font-black tracking-[0.12em] bg-[#1677FF]/15 text-[#00A8E8] border border-[#00A8E8]/30 px-3 py-1 rounded-full">${owned ? 'OWNED' : 'BUY / RENT'}</span>
      </div>
    </div>
  </div>`;
}

export function getFilteredMovies() {
  let list = [...movies];
  if (activeGenre !== 'All') {
    list = list.filter(m => m.genre.toLowerCase() === activeGenre.toLowerCase());
  }
  if (sortBy === 'price-low') list.sort((a, b) => a.price - b.price);
  if (sortBy === 'price-high') list.sort((a, b) => b.price - a.price);
  if (sortBy === 'rating') list.sort((a, b) => b.rating - a.rating);
  if (sortBy === 'year') list.sort((a, b) => (b.year || 2024) - (a.year || 2024));
  return list;
}

export function renderHeroCollection() {
  if (!movies || movies.length === 0) return;
  const container = document.getElementById('heroPosterStack');
  if (!container) return;

  const total = movies.length;
  const m1 = movies[heroCarouselIndex % total];
  const m2 = movies[(heroCarouselIndex + 1) % total];
  const m3 = movies[(heroCarouselIndex + 2) % total];

  const p1 = resolvePoster(m1.poster, m1.title);
  const p2 = resolvePoster(m2.poster, m2.title);
  const p3 = resolvePoster(m3.poster, m3.title);

  const ph1 = getNeutralPlaceholder(m1.title);
  const ph2 = getNeutralPlaceholder(m2.title);
  const ph3 = getNeutralPlaceholder(m3.title);

  container.innerHTML = `
    <div class="hidden sm:block w-[105px] shrink-0 rounded-2xl overflow-hidden border border-white/15 bg-[#10182B] shadow-lg rotate-[-6deg] translate-y-3 transition duration-700">
      <img src="${p1}" onerror="this.onerror=null; this.src='${ph1}';" class="w-full h-[155px] object-cover">
      <div class="p-2 text-[10px] font-black text-white truncate bg-[#10182B]">${m1.title}</div>
    </div>
    <div class="w-[175px] shrink-0 rounded-2xl overflow-hidden border-2 border-[#1677FF] bg-[#10182B] shadow-2xl z-10 transition duration-700">
      <img src="${p2}" onerror="this.onerror=null; this.src='${ph2}';" class="w-full h-[235px] object-cover">
      <div class="p-3 bg-[#10182B] border-t border-white/10 flex items-center justify-between">
        <div class="truncate max-w-[100px]">
          <div class="font-black text-xs text-white truncate">${m2.title}</div>
          <div class="text-[9px] font-bold text-[#8491A7]">${m2.genre}</div>
        </div>
        <span class="bg-[#1677FF] text-white text-[10px] font-black px-2 py-0.5 rounded-full">★ ${m2.rating}</span>
      </div>
    </div>
    <div class="hidden sm:block w-[105px] shrink-0 rounded-2xl overflow-hidden border border-white/15 bg-[#10182B] shadow-lg rotate-[6deg] translate-y-3 transition duration-700">
      <img src="${p3}" onerror="this.onerror=null; this.src='${ph3}';" class="w-full h-[155px] object-cover">
      <div class="p-2 text-[10px] font-black text-white truncate bg-[#10182B]">${m3.title}</div>
    </div>
  `;
}

export function renderMoviesCatalog(onUpdateCounts) {
  const filtered = getFilteredMovies();
  const featured = filtered.filter(m => m.featured);
  const gridList = filtered;

  const fRow = document.getElementById('featuredRow');
  if (fRow) {
    fRow.innerHTML = featured.map(m => `<div class="min-w-[220px] sm:min-w-[240px] snap-start">${movieCard(m)}</div>`).join('') || `<div class="text-sm font-bold text-[#8491A7] py-10">No films match your filters.</div>`;
  }

  const grid = document.getElementById('movieGrid');
  if (grid) {
    grid.innerHTML = gridList.map(m => movieCard(m)).join('') || `<div class="col-span-full text-center text-sm font-bold text-[#8491A7] py-10">No movies found in TMDB catalog.</div>`;
  }

  renderHeroCollection();
  if (onUpdateCounts) onUpdateCounts();
  attachCardEvents(onUpdateCounts);
}

export function startHeroTimer() {
  if (!window.heroTimer) {
    window.heroTimer = setInterval(() => {
      if (movies && movies.length > 0) {
        heroCarouselIndex = (heroCarouselIndex + 1) % movies.length;
        renderHeroCollection();
      }
    }, 6000);
  }
}

export function attachCardEvents(onUpdateCounts) {
  document.querySelectorAll('.movie-card').forEach(card => {
    const id = parseInt(card.dataset.id);
    const m = movies.find(x => x.id === id);
    if (!m) return;
    card.querySelector('.details-btn')?.addEventListener('click', (e) => { e.stopPropagation(); openModal(m, onUpdateCounts); });
    card.querySelector('.cart-btn')?.addEventListener('click', (e) => { e.stopPropagation(); addToCart(m, 'purchase', onUpdateCounts); });
    card.querySelector('.fav-btn')?.addEventListener('click', (e) => { e.stopPropagation(); toggleFav(id, onUpdateCounts); });
    card.addEventListener('click', () => openModal(m, onUpdateCounts));

    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left, y = e.clientY - rect.top;
      const rx = (y / rect.height - 0.5) * -6, ry = (x / rect.width - 0.5) * 6;
      card.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-6px)`;
    });
    card.addEventListener('mouseleave', () => card.style.transform = '');
  });
}

export function toggleFav(id, onUpdateCounts) {
  if (favorites.has(id)) favorites.delete(id); else favorites.add(id);
  saveFavorites();
  renderMoviesCatalog(onUpdateCounts);
  showToast(favorites.has(id) ? 'Saved to favorites ♥' : 'Removed from favorites');
}

export function openModal(m, onUpdateCounts) {
  const modal = document.getElementById('movieModal');
  const content = document.getElementById('modalContent');
  const library = getLibrary();
  const isOwned = library.some(l => l.id === m.id);
  const placeholder = getNeutralPlaceholder(m.title);

  content.innerHTML = `
    <div class="relative h-[320px] sm:h-[380px] overflow-hidden bg-[#05070D]">
      <img src="${m.backdrop}" onerror="this.onerror=null; this.src='${placeholder}';" class="w-full h-full object-cover">
      <div class="absolute inset-0 bg-gradient-to-t from-[#0B1020] via-[#0B1020]/50 to-transparent"></div>
      <div class="absolute inset-0 bg-gradient-to-r from-[#05070D]/80 via-transparent to-transparent"></div>
      <div class="absolute bottom-0 left-0 right-0 p-6 sm:p-8 flex gap-5 items-end">
        <img src="${m.poster}" onerror="this.onerror=null; this.src='${placeholder}';" class="w-28 sm:w-36 h-40 sm:h-50 rounded-2xl object-cover shadow-2xl border-2 border-white/20 hidden sm:block">
        <div class="flex-1 min-w-0 pb-1">
          <div class="inline-flex items-center gap-2 bg-[#1677FF] text-white text-[10px] font-black tracking-widest px-3 py-1.5 rounded-full">★ ${m.rating} • ${m.year || 2024} • TMDB ID: ${m.tmdb_id || m.id}</div>
          <h3 class="text-3xl sm:text-4xl font-black tracking-tighter text-white drop-shadow-lg mt-3">${m.title}</h3>
          <div class="text-[#C7D0E0] text-xs font-bold tracking-widest mt-1">${m.genre.toUpperCase()} • DIGITAL LICENSE PLATFORM</div>
        </div>
      </div>
    </div>
    <div class="p-6 sm:p-8">
      <div class="flex flex-wrap gap-3">
        ${isOwned ? `<button onclick="showToast('Digital license active in your CineVerse vault ✓')" class="flex-1 min-w-[180px] bg-[#1677FF] text-white py-4 rounded-full font-black tracking-widest flex items-center justify-center gap-2 hover:bg-[#3D8BFF] transition"><i class="ri-shield-check-line text-xl"></i> LICENSE OWNED ✓</button>` : `
          <button id="modalBuy" class="flex-1 min-w-[160px] bg-[#1677FF] text-white py-4 rounded-full font-black tracking-widest flex items-center justify-center gap-2 hover:bg-[#3D8BFF] transition">BUY — ${formatPrice(m.price)} <i class="ri-shopping-bag-line"></i></button>
          <button id="modalRent" class="flex-1 min-w-[160px] bg-white/10 border border-white/20 text-white py-4 rounded-full font-black tracking-widest flex items-center justify-center gap-2 hover:bg-white/20 transition">RENT 48H — ${formatPrice(m.rental_price)} <i class="ri-time-line"></i></button>
        `}
        <button id="modalFav" class="px-6 py-4 rounded-full border border-white/15 bg-white/5 font-black text-xs tracking-widest flex items-center gap-2 hover:bg-white/10 text-white transition"><i class="${favorites.has(m.id) ? 'ri-heart-3-fill text-[#00A8E8]' : 'ri-heart-3-line'}"></i> ${favorites.has(m.id) ? 'SAVED' : 'SAVE'}</button>
        <button id="modalShare" class="px-6 py-4 rounded-full border border-white/15 bg-white/5 font-black text-xs tracking-widest flex items-center gap-2 hover:bg-white/10 text-white transition"><i class="ri-share-line"></i> SHARE</button>
      </div>
      <div class="grid lg:grid-cols-3 gap-6 mt-8">
        <div class="lg:col-span-2">
          <h4 class="font-black tracking-tighter text-lg text-white">TMDB OVERVIEW</h4>
          <p class="text-sm leading-6 font-medium text-[#C7D0E0] mt-2">${m.synopsis || m.description} Own or rent this digital movie license on CineVerse. View on supported partner devices (Apple TV, Google TV, Prime Video, Movies Anywhere).</p>
          <div class="mt-6 flex flex-wrap gap-2">
            <span class="bg-white/5 border border-white/10 px-3 py-1.5 rounded-full text-xs font-bold text-white/80">4K HDR</span>
            <span class="bg-white/5 border border-white/10 px-3 py-1.5 rounded-full text-xs font-bold text-white/80">DOLBY ATMOS</span>
            <span class="bg-white/5 border border-white/10 px-3 py-1.5 rounded-full text-xs font-bold text-[#00A8E8]">TMDB METADATA</span>
          </div>
        </div>
        <div class="bg-[#10182B] rounded-2xl border border-white/10 p-5">
          <div class="font-black text-sm text-white">COMMERCE DETAILS</div>
          <div class="mt-4 space-y-2 text-xs font-medium text-[#C7D0E0]">
            <div class="flex justify-between"><span class="text-[#8491A7]">Genre</span><span class="font-bold text-white">${m.genre}</span></div>
            <div class="flex justify-between"><span class="text-[#8491A7]">Buy Price</span><span class="font-bold text-[#00A8E8]">${formatPrice(m.price)}</span></div>
            <div class="flex justify-between"><span class="text-[#8491A7]">Rent Price</span><span class="font-bold text-white">${formatPrice(m.rental_price)}</span></div>
            <div class="flex justify-between"><span class="text-[#8491A7]">TMDB Rating</span><span class="font-bold text-[#00A8E8]">★ ${m.rating}/10</span></div>
          </div>
        </div>
      </div>
    </div>
  `;

  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  document.getElementById('modalFav')?.addEventListener('click', () => { toggleFav(m.id, onUpdateCounts); openModal(movies.find(x => x.id === m.id), onUpdateCounts); });
  document.getElementById('modalBuy')?.addEventListener('click', () => { addToCart(m, 'purchase', onUpdateCounts); closeModal(); });
  document.getElementById('modalRent')?.addEventListener('click', () => { addToCart(m, 'rental', onUpdateCounts); closeModal(); });
  document.getElementById('modalShare')?.addEventListener('click', () => { navigator.clipboard.writeText(window.location.href); showToast('Link copied to clipboard ✓'); });
}

export function closeModal() {
  document.getElementById('movieModal').classList.add('hidden');
  document.body.style.overflow = '';
}
