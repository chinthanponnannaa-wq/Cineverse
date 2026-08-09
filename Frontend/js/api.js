// Frontend/js/api.js — Backend REST API Client

import { API_BASE_URL, resolvePoster, showToast } from './utils.js';

export async function fetchMoviesApi() {
  const res = await fetch(`${API_BASE_URL}/movies/`);
  if (!res.ok) throw new Error('Failed to fetch movies catalog');
  const data = await res.json();
  if (Array.isArray(data) && data.length > 0) {
    return data.map((m, idx) => {
      const mId = m.movie_id || m.MovieID || (idx + 1);
      const title = m.title || m.MovieName || 'Movie Title';
      const genre = m.genre || m.Category || 'Cinema';
      const posterRaw = m.poster_image || m.ImageName || '';
      const poster = resolvePoster(posterRaw, title);
      const backdropRaw = m.backdrop_image || posterRaw;
      const backdrop = resolvePoster(backdropRaw, title);

      return {
        id: mId,
        movie_id: mId,
        tmdb_id: m.tmdb_id || mId,
        title: title,
        genre: genre,
        price: parseFloat(m.price || m.Price || 499),
        rental_price: parseFloat(m.rental_price || 149),
        rating: parseFloat(m.rating || m.Rating || 8.0),
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
  }
  return [];
}

export async function fetchUserOrdersApi(userId) {
  const res = await fetch(`${API_BASE_URL}/orders/${userId}/`);
  if (!res.ok) throw new Error('Failed to fetch user orders');
  return await res.json();
}

export async function fetchGuestCartApi(sessionId) {
  const res = await fetch(`${API_BASE_URL}/session-cart/${sessionId}/`);
  if (!res.ok) throw new Error('Failed to fetch guest cart');
  return await res.json();
}

export async function apiAddToCart(movie, isLoggedIn, sessionId) {
  if (isLoggedIn) {
    try {
      await fetch(`${API_BASE_URL}/update-quantity/${movie.id}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: 1 })
      });
    } catch (e) { console.error("Error updating cart quantity:", e); }
  } else {
    try {
      await fetch(`${API_BASE_URL}/session-cart/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sessionId, movieId: movie.id, quantity: 1 })
      });
    } catch (e) { console.error("Error posting session cart:", e); }
  }
}

export async function apiRemoveFromCart(movieId, isLoggedIn, sessionId) {
  if (isLoggedIn) {
    try {
      await fetch(`${API_BASE_URL}/update-quantity/${movieId}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: -1 })
      });
    } catch (e) { console.error("Error removing cart quantity:", e); }
  } else {
    try {
      await fetch(`${API_BASE_URL}/session-cart/clear/${sessionId}/`, { method: 'DELETE' });
    } catch (e) { console.error("Error removing session cart item:", e); }
  }
}

export async function transferGuestCartToUser(sessionId) {
  try {
    const res = await fetch(`${API_BASE_URL}/session-cart/${sessionId}/`);
    if (res.ok) {
      const guestItems = await res.json();
      for (const git of guestItems) {
        const mId = git.movie_id;
        const qty = git.quantity || 1;
        await fetch(`${API_BASE_URL}/update-quantity/${mId}/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quantity: qty })
        });
      }
      await fetch(`${API_BASE_URL}/session-cart/clear/${sessionId}/`, { method: 'DELETE' });
    }
  } catch (e) { console.error("Error transferring guest cart:", e); }
}

export async function apiSignup(name, email, password) {
  const res = await fetch(`${API_BASE_URL}/signup/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name, email: email, password: password })
  });
  return await res.json();
}

export async function apiLogin(email, password) {
  const res = await fetch(`${API_BASE_URL}/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email, password: password })
  });
  return await res.json();
}

export async function apiLogout(userId) {
  try {
    await fetch(`${API_BASE_URL}/logout/${userId}/`, { method: 'POST' });
  } catch (e) { console.error("Logout API error:", e); }
}

export async function apiCreateOrder(orderPayload) {
  const res = await fetch(`${API_BASE_URL}/create-order/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderPayload)
  });
  return await res.json();
}

export async function apiVerifyPayment(paymentPayload) {
  const res = await fetch(`${API_BASE_URL}/verify-payment/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(paymentPayload)
  });
  return await res.json();
}

export async function apiVoiceCommand(transcriptText) {
  const res = await fetch(`${API_BASE_URL}/voice/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript: transcriptText })
  });
  return await res.json();
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

