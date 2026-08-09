// Frontend/js/library.js — Library Vault & Order History

import { formatPrice, getNeutralPlaceholder } from './utils.js';
import { fetchWatchProviders } from './api.js';

let library = [];
let userOrders = [];

export function getLibrary() { return library; }
export function setLibrary(l) { library = l; }

export function getUserOrders() { return userOrders; }
export function setUserOrders(o) { userOrders = o; }

export function renderLibrary() {
  const grid = document.getElementById('libraryGrid');
  if (!grid) return;
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
          <div class="text-xs font-medium text-[#8491A7] mt-0.5">${m.genre} • ${m.year || 2024}</div>
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
