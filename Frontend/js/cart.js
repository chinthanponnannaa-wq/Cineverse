// Frontend/js/cart.js — Shopping Cart & Checkout Engine

import { formatPrice, getNeutralPlaceholder, showToast } from './utils.js';
import { apiAddToCart, apiRemoveFromCart, apiCreateOrder, apiVerifyPayment, fetchUserOrdersApi } from './api.js';
import { getIsLoggedIn, getCurrentUser, getSessionId } from './auth.js';
import { getLibrary, setLibrary, setUserOrders } from './library.js';

let cart = [];

export function getCart() { return cart; }
export function setCart(c) { cart = c; }

export function updateCartCounts() {
  document.getElementById('cartBadge').textContent = cart.length;
  document.getElementById('cartCountLabel').textContent = cart.length + ' ITEMS';

  const library = getLibrary();
  const subtotal = cart.reduce((s, m) => s + (m.selected_price || m.price), 0);
  const tax = subtotal * 0.08;
  const total = subtotal + tax;

  const sumSub = document.getElementById('sumSubtotal');
  if (sumSub) sumSub.textContent = formatPrice(subtotal);

  const sumTx = document.getElementById('sumTax');
  if (sumTx) sumTx.textContent = formatPrice(tax);

  const sumTot = document.getElementById('sumTotal');
  if (sumTot) sumTot.textContent = formatPrice(total);

  const hasCart = cart.length > 0;
  const cartEmpty = document.getElementById('cartEmpty');
  if (cartEmpty) cartEmpty.classList.toggle('hidden', hasCart);

  const cartList = document.getElementById('cartList');
  if (cartList) cartList.classList.toggle('hidden', !hasCart);
}

export function renderCartList(onUpdateCounts, onRenderCatalog) {
  const el = document.getElementById('cartList');
  if (!el) return;
  if (cart.length === 0) { el.innerHTML = ''; return; }

  el.innerHTML = cart.map(m => {
    const placeholder = getNeutralPlaceholder(m.title);
    const isRental = m.license_type === 'rental';
    const priceVal = m.selected_price || (isRental ? m.rental_price : m.price);
    return `
      <div class="flex gap-4 bg-[#10182B] rounded-2xl p-3.5 border border-white/10">
        <img src="${m.poster}" onerror="this.onerror=null; this.src='${placeholder}';" class="w-20 h-28 rounded-xl object-cover shrink-0">
        <div class="flex-1 min-w-0 py-1">
          <div class="font-black text-sm leading-tight truncate text-white">${m.title}</div>
          <div class="text-xs font-bold text-[#8491A7] mt-0.5">${m.year || 2024} • ${m.genre}</div>
          <div class="flex items-center gap-2 mt-2">
            <span class="bg-[#1677FF]/20 text-[#00A8E8] border border-[#00A8E8]/30 text-[10px] font-black px-2.5 py-1 rounded-full uppercase">${isRental ? '48-Hour Rental' : 'Permanent Buy'}</span>
            <span class="bg-[#1677FF] text-white text-[10px] font-black px-2 py-1 rounded-full">★ ${m.rating}</span>
          </div>
          <div class="flex items-center justify-between mt-3">
            <span class="font-black text-base text-white">${formatPrice(priceVal)}</span>
            <button data-remove="${m.id}" class="text-xs font-black tracking-widest text-[#8491A7] hover:text-red-400 underline decoration-2 transition">REMOVE</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  el.querySelectorAll('[data-remove]').forEach(b => {
    b.addEventListener('click', async () => {
      const remId = parseInt(b.dataset.remove);
      await removeFromCart(remId, onUpdateCounts, onRenderCatalog);
    });
  });
}

export async function addToCart(m, licenseType = 'purchase', onUpdateCounts) {
  const library = getLibrary();
  if (library.some(l => l.id === m.id)) { showToast('License already owned ✓'); return; }
  if (cart.some(c => c.id === m.id)) { showToast('Already in cart'); return; }
  const cartItem = {
    ...m,
    license_type: licenseType,
    selected_price: licenseType === 'rental' ? m.rental_price : m.price
  };
  cart.push(cartItem);
  await apiAddToCart(m, getIsLoggedIn(), getSessionId());
  if (onUpdateCounts) onUpdateCounts();
  renderCartList(onUpdateCounts);
  showToast(`Added ${licenseType === 'rental' ? 'Rental' : 'Purchase'} to cart — ${m.title}`);
}

export async function removeFromCart(remId, onUpdateCounts, onRenderCatalog) {
  cart = cart.filter(c => c.id !== remId);
  await apiRemoveFromCart(remId, getIsLoggedIn(), getSessionId());
  if (onUpdateCounts) onUpdateCounts();
  renderCartList(onUpdateCounts, onRenderCatalog);
  if (onRenderCatalog) onRenderCatalog();
  showToast('Removed from cart');
}

export async function handleCheckout(navigateFn, onUpdateCounts, onRenderLibrary) {
  if (cart.length === 0) { showToast('Cart is empty'); return; }
  if (!getIsLoggedIn() || !getCurrentUser()) {
    if (navigateFn) navigateFn('login');
    showToast('Please sign in to purchase');
    return;
  }

  const currentUser = getCurrentUser();
  const subtotal = cart.reduce((s, m) => s + (m.selected_price || m.price), 0);
  const tax = subtotal * 0.08;
  const totalAmount = subtotal + tax;
  const selectedPayMethod = document.querySelector('input[name="payMethod"]:checked')?.value || 'COD';

  try {
    const orderPayload = {
      userId: currentUser.user_id,
      amount: totalAmount,
      items: cart,
      paymentMethod: selectedPayMethod
    };

    const data = await apiCreateOrder(orderPayload);

    if (data.success) {
      if (selectedPayMethod === 'UPI' && data.razorpayOrderId && window.Razorpay) {
        const options = {
          "key": data.keyId || "",
          "amount": Math.round(totalAmount * 100),
          "currency": "INR",
          "name": "CineVerse",
          "description": "Digital Movie License",
          "order_id": data.razorpayOrderId,
          "handler": async function (response) {
            try {
              const vData = await apiVerifyPayment({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
                orderId: data.orderId
              });
              if (vData.success) {
                cart = [];
                const orderData = await fetchUserOrdersApi(currentUser.user_id);
                setUserOrders(orderData);
                if (onUpdateCounts) onUpdateCounts();
                renderCartList(onUpdateCounts);
                if (onRenderLibrary) onRenderLibrary();
                showToast('Payment verified & order completed ✓');
                if (navigateFn) navigateFn('library');
              } else {
                showToast('Payment verification failed');
              }
            } catch (e) { showToast('Payment verification error'); }
          },
          "prefill": {
            "name": currentUser.name,
            "email": currentUser.email
          },
          "theme": { "color": "#1677FF" }
        };
        const rzp = new window.Razorpay(options);
        rzp.open();
      } else {
        cart = [];
        const orderData = await fetchUserOrdersApi(currentUser.user_id);
        setUserOrders(orderData);
        if (onUpdateCounts) onUpdateCounts();
        renderCartList(onUpdateCounts);
        if (onRenderLibrary) onRenderLibrary();
        showToast('Order placed successfully — added to Library ✓');
        if (navigateFn) navigateFn('library');
      }
    } else {
      showToast(data.error || 'Order creation failed');
    }
  } catch (err) {
    showToast('Network error during checkout');
  }
}
