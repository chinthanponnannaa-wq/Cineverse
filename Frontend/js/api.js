// Frontend/js/api.js — Backend REST API Client

import { API_BASE_URL, resolvePoster, showToast } from './utils.js';

export async function safeFetchJson(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (res.status === 401) {
      return { ok: false, status: 401, error: 'Your session has expired. Please sign in again.' };
    }
    if (res.status === 403) {
      return { ok: false, status: 403, error: 'Access denied.' };
    }
    if (res.status === 404) {
      return { ok: false, status: 404, error: 'Requested resource not found.' };
    }
    if (res.status >= 500) {
      return { ok: false, status: res.status, error: 'Server error. Please try again later.' };
    }
    
    let data;
    try {
      data = await res.json();
    } catch (parseErr) {
      return { ok: false, status: res.status, error: 'Invalid response format from server.' };
    }
    
    if (!res.ok) {
      return { ok: false, status: res.status, data, error: data.error || data.message || 'Request failed.' };
    }
    
    return { ok: true, status: res.status, data };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return { ok: false, status: 0, error: 'Request timed out. Please check your network connection.' };
    }
    return { ok: false, status: 0, error: 'Network error or server unreachable. Please try again.' };
  }
}

export async function fetchMoviesApi({ page = 1, limit = 24, genre = 'All', sort = 'featured' } = {}) {
  const queryParams = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    genre: genre,
    sort: sort
  });

  const res = await safeFetchJson(`${API_BASE_URL}/movies/?${queryParams.toString()}`);
  if (!res.ok) {
    throw new Error(res.error || 'Failed to fetch movies catalog');
  }
  const payload = res.data;
  
  const rawList = Array.isArray(payload) ? payload : (payload.movies || []);
  const pagination = payload.pagination || { page, limit, total: rawList.length, has_next: false };

  const normalizedMovies = rawList.map((m, idx) => {
    const mId = m.movie_id || m.MovieID || (idx + 1);
    const title = m.title || m.MovieName || 'Movie Title';
    const g = m.genre || m.Category || 'Cinema';
    const posterRaw = m.poster_image || m.ImageName || '';
    const poster = resolvePoster(posterRaw, title);
    const backdropRaw = m.backdrop_image || posterRaw;
    const backdrop = resolvePoster(backdropRaw, title);

    const imdbId1 = m.imdb_id || null;
    const imdbRating1 = (m.imdb_rating !== null && m.imdb_rating !== undefined && !isNaN(m.imdb_rating)) ? parseFloat(m.imdb_rating) : null;
    const tmdbRating1 = (m.tmdb_rating !== null && m.tmdb_rating !== undefined && !isNaN(m.tmdb_rating)) ? parseFloat(m.tmdb_rating) : 8.0;
    const rawRating1 = m.rating ?? m.Rating;
    const parsedRating1 = (rawRating1 !== null && rawRating1 !== undefined && !isNaN(rawRating1)) ? parseFloat(rawRating1) : (imdbRating1 ?? tmdbRating1);

    return {
      id: mId,
      movie_id: mId,
      tmdb_id: m.tmdb_id || mId,
      imdb_id: imdbId1,
      imdb_rating: imdbRating1,
      tmdb_rating: tmdbRating1,
      title: title,
      genre: g,
      price: parseFloat(m.price || m.Price || 499),
      rental_price: parseFloat(m.rental_price || 149),
      rating: parsedRating1,
      description: m.description || m.Description || 'No description available.',
      synopsis: m.description || m.Description || 'No description available.',
      poster: poster,
      backdrop: backdrop,
      quantity: m.quantity || m.Quantity || 0,
      year: 2024,
      runtime: '2h 15m',
      featured: idx < 8,
      trending: idx < 6
    };
  });

  return { movies: normalizedMovies, pagination };
}

export async function apiSearchMovies(query) {
  if (!query) return [];
  try {
    const res = await safeFetchJson(`${API_BASE_URL}/movies/search/?query=${encodeURIComponent(query)}`);
    if (!res.ok || !Array.isArray(res.data)) return [];
    return res.data.map((m, idx) => {
      const mId = m.movie_id || m.MovieID || (idx + 1);
      const title = m.title || m.MovieName || 'Movie Title';
      const genre = m.genre || m.Category || 'Cinema';
      const posterRaw = m.poster_image || m.ImageName || '';
      const poster = resolvePoster(posterRaw, title);
      const backdropRaw = m.backdrop_image || posterRaw;
      const backdrop = resolvePoster(backdropRaw, title);
      const imdbId2 = m.imdb_id || null;
      const imdbRating2 = (m.imdb_rating !== null && m.imdb_rating !== undefined && !isNaN(m.imdb_rating)) ? parseFloat(m.imdb_rating) : null;
      const tmdbRating2 = (m.tmdb_rating !== null && m.tmdb_rating !== undefined && !isNaN(m.tmdb_rating)) ? parseFloat(m.tmdb_rating) : 8.0;
      const rawRating2 = m.rating ?? m.Rating;
      const parsedRating2 = (rawRating2 !== null && rawRating2 !== undefined && !isNaN(rawRating2)) ? parseFloat(rawRating2) : (imdbRating2 ?? tmdbRating2);

      return {
        id: mId,
        movie_id: mId,
        tmdb_id: m.tmdb_id || mId,
        imdb_id: imdbId2,
        imdb_rating: imdbRating2,
        tmdb_rating: tmdbRating2,
        title: title,
        genre: genre,
        price: parseFloat(m.price || m.Price || 499),
        rental_price: parseFloat(m.rental_price || 149),
        rating: parsedRating2,
        description: m.description || m.Description || 'No description available.',
        synopsis: m.description || m.Description || 'No description available.',
        poster: poster,
        backdrop: backdrop,
        quantity: m.quantity || 0,
        year: 2024
      };
    });
  } catch (e) {
    console.warn("API search error:", e);
    return [];
  }
}

function getAuthHeaders() {
  const u = JSON.parse(localStorage.getItem('cv_user') || 'null');
  const token = u?.token || localStorage.getItem('cv_token') || '';
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

export async function fetchUserOrdersApi(userId) {
  const headers = getAuthHeaders();
  const res = await safeFetchJson(`${API_BASE_URL}/orders/${userId}/`, { headers });
  if (!res.ok) throw new Error(res.error || 'Failed to fetch user orders');
  return res.data;
}

export async function fetchGuestCartApi(sessionId) {
  const res = await safeFetchJson(`${API_BASE_URL}/session-cart/${sessionId}/`);
  if (!res.ok) throw new Error(res.error || 'Failed to fetch guest cart');
  return res.data;
}

export async function apiAddToCart(movie, isLoggedIn, sessionId) {
  if (isLoggedIn) {
    await safeFetchJson(`${API_BASE_URL}/update-quantity/${movie.id}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ quantity: 1 })
    });
  } else {
    await safeFetchJson(`${API_BASE_URL}/session-cart/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sessionId, movieId: movie.id, quantity: 1 })
    });
  }
}

export async function apiRemoveFromCart(movieId, isLoggedIn, sessionId) {
  if (isLoggedIn) {
    await safeFetchJson(`${API_BASE_URL}/update-quantity/${movieId}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ quantity: -1 })
    });
  } else {
    await safeFetchJson(`${API_BASE_URL}/session-cart/clear/${sessionId}/`, { method: 'DELETE' });
  }
}

export async function transferGuestCartToUser(sessionId) {
  try {
    const res = await safeFetchJson(`${API_BASE_URL}/session-cart/${sessionId}/`);
    if (res.ok && Array.isArray(res.data)) {
      for (const git of res.data) {
        const mId = git.movie_id;
        const qty = git.quantity || 1;
        await safeFetchJson(`${API_BASE_URL}/update-quantity/${mId}/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({ quantity: qty })
        });
      }
      await safeFetchJson(`${API_BASE_URL}/session-cart/clear/${sessionId}/`, { method: 'DELETE' });
    }
  } catch (e) { console.error("Error transferring guest cart:", e); }
}

export async function apiSignup(name, email, password) {
  const res = await safeFetchJson(`${API_BASE_URL}/signup/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name, email: email, password: password })
  });
  return res.ok ? res.data : { success: false, error: res.error };
}

export async function apiLogin(email, password) {
  const res = await safeFetchJson(`${API_BASE_URL}/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email, password: password })
  });
  return res.ok ? res.data : { success: false, error: res.error };
}

export async function apiLogout(userId) {
  try {
    const headers = { 'Content-Type': 'application/json', ...getAuthHeaders() };
    await safeFetchJson(`${API_BASE_URL}/logout/${userId}/`, { method: 'POST', headers });
  } catch (e) { console.error("Logout API error:", e); }
}

export async function apiCreateOrder(orderPayload) {
  const res = await safeFetchJson(`${API_BASE_URL}/create-order/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(orderPayload)
  });
  return res.ok ? res.data : { success: false, error: res.error };
}

export async function apiVerifyPayment(paymentPayload) {
  const res = await safeFetchJson(`${API_BASE_URL}/verify-payment/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(paymentPayload)
  });
  return res.ok ? res.data : { success: false, error: res.error };
}

export async function apiVoiceCommand(transcriptText) {
  const res = await safeFetchJson(`${API_BASE_URL}/voice/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript: transcriptText })
  });
  return res.ok ? res.data : { text: "Voice assistant offline. Please try again." };
}

export async function fetchWatchProviders(tmdbId) {
  try {
    const res = await fetch(`${API_BASE_URL}/watch-providers/${tmdbId}/`);
    const data = await res.json();
    if (res.ok && data.available && data.providers && data.providers.length > 0) {
      showToast('Available on: ' + data.providers.join(', '));
    } else {
      showToast(data.message || 'Watch provider information is unavailable for this title.');
    }
  } catch (e) {
    showToast('Watch provider information unavailable for this title.');
  }
}

