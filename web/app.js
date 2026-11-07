/**
 * Bodegón & Market Ato'z - 3D Interactive Engine & Shopping Cart System
 * Official RIF: J-500277490 | "Más que un Bodegón"
 * 100% Bodegón & Market (Licores, Whiskies, Cervezas, Tobos, Mixers, Snacks & Hielo)
 */

// 1. BODEGÓN & MARKET PRODUCTS DATASET (NO FOOD)
const PRODUCTS = [
  // LICORES & RONES
  {
    id: 'lic-1',
    title: 'Santa Teresa 1796 (750ml)',
    category: 'licores',
    price: 45.00,
    badge: 'Solera Premium',
    image: 'https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=500&auto=format&fit=crop&q=80',
    description: 'Ron ultra premium elaborado con método solera. Incluye bolsa de hielo y refresco 1.5L.'
  },
  {
    id: 'lic-2',
    title: 'Cacique Leyenda (750ml)',
    category: 'licores',
    price: 25.00,
    badge: 'Añejo Especial',
    image: 'https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=500&auto=format&fit=crop&q=80',
    description: 'Mezcla dorada de rones añejos venezolanos. Incluye 2 Coca-Colas de 1.5L e hielo.'
  },
  {
    id: 'lic-3',
    title: 'Pampero Aniversario Reserva Exclusiva',
    category: 'licores',
    price: 38.00,
    badge: 'Edición Cuero',
    image: 'https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=500&auto=format&fit=crop&q=80',
    description: 'Ron premiado internacionalmente en su característica funda de cuero. Incluye hielo.'
  },
  {
    id: 'lic-4',
    title: 'Diplomático Reserva Exclusiva (750ml)',
    category: 'licores',
    price: 48.00,
    badge: 'World Class',
    image: 'https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=500&auto=format&fit=crop&q=80',
    description: 'Ron dulce y equilibrado, añejado en barricas de roble blanco por hasta 12 años.'
  },

  // WHISKIES & LIQUOR
  {
    id: 'wsk-1',
    title: 'Johnnie Walker Black Label 12 Años',
    category: 'whisky',
    price: 55.00,
    badge: 'Scotch 12 Años',
    image: 'https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=500&auto=format&fit=crop&q=80',
    description: 'Iconico Blended Scotch Whisky 12 Años (750ml). Incluye hielera y 2 aguas con gas.'
  },
  {
    id: 'wsk-2',
    title: 'Old Parr 12 Años (750ml)',
    category: 'whisky',
    price: 52.00,
    badge: 'Clásico VIP',
    image: 'https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=500&auto=format&fit=crop&q=80',
    description: 'Whisky escocés de sabor suave, completo y aterciopelado. Incluye bolsa de hielo.'
  },
  {
    id: 'wsk-3',
    title: 'Buchanan\'s Deluxe 12 Años (750ml)',
    category: 'whisky',
    price: 58.00,
    badge: 'Favorito',
    image: 'https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=500&auto=format&fit=crop&q=80',
    description: 'Whisky con notas frutales, de naranja y chocolate. Incluye hielera y mixers.'
  },
  {
    id: 'wsk-4',
    title: 'Jack Daniel\'s Old No. 7 Tennessee',
    category: 'whisky',
    price: 42.00,
    badge: 'Tennessee Whiskey',
    image: 'https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=500&auto=format&fit=crop&q=80',
    description: 'Whiskey de roble quemado al carbón de arce (750ml). Incluye Coca-Cola 1.5L.'
  },

  // TOBOS & CERVEZAS
  {
    id: 'cer-1',
    title: 'Tobo Zulia (10 Cervezas Vestidas de Novia)',
    category: 'cervezas',
    price: 18.00,
    badge: 'Más Vendido',
    image: 'https://images.unsplash.com/photo-1608270586620-248524c67de9?w=500&auto=format&fit=crop&q=80',
    description: 'Tobo metálico con 10 tercios de Cerveza Zulia congeladas en abundante hielo.'
  },
  {
    id: 'cer-2',
    title: 'Tobo Polar Pilsen (10 Cervezas Heladas)',
    category: 'cervezas',
    price: 16.00,
    badge: 'La Negra',
    image: 'https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=500&auto=format&fit=crop&q=80',
    description: '10 Cervezas Polar Pilsen de 222ml vestidas de novia en abundante hielo picado.'
  },
  {
    id: 'cer-3',
    title: 'Tobo Solera Verde / Light (10 Uds)',
    category: 'cervezas',
    price: 20.00,
    badge: 'Premium',
    image: 'https://images.unsplash.com/photo-1608270586620-248524c67de9?w=500&auto=format&fit=crop&q=80',
    description: 'Tobo de 10 unidades Solera Verde o Light super frías con hielera para servir.'
  },
  {
    id: 'cer-4',
    title: 'Pack Corona Extra (6 Botellas)',
    category: 'cervezas',
    price: 15.00,
    badge: 'Importada',
    image: 'https://images.unsplash.com/photo-1584225064785-c62a8b43d148?w=500&auto=format&fit=crop&q=80',
    description: '6 unidades de Cerveza Corona Extra 355ml frías servidas con limones frescos.'
  },

  // CÓCTELES & MIXERS
  {
    id: 'coc-1',
    title: 'Bolsa de Hielo Gourmet (3kg)',
    category: 'cocteles',
    price: 3.00,
    badge: 'Indispensable',
    image: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=500&auto=format&fit=crop&q=80',
    description: 'Hielo en cubos macizos cristalinos de alta duración en bolsa sellada de 3kg.'
  },
  {
    id: 'coc-2',
    title: 'Pack Mixers Coca-Cola (2 de 1.5L)',
    category: 'cocteles',
    price: 5.00,
    badge: 'Refrescos',
    image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=500&auto=format&fit=crop&q=80',
    description: '2 botellas de Coca-Cola Original frías de 1.5 Litros ideal para tus tragos.'
  },
  {
    id: 'coc-3',
    title: 'Agua Quina / Soda Schweppes (Pack 4)',
    category: 'cocteles',
    price: 6.00,
    badge: 'Coctelería',
    image: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=500&auto=format&fit=crop&q=80',
    description: '4 latas frías de Agua Tónica / Soda Schweppes ideales para Ginebra o Whisky.'
  },

  // SNACKS DE BODEGÓN & DELICATESES
  {
    id: 'snk-1',
    title: 'Papas Pringles Original / Queso (158g)',
    category: 'delicateses',
    price: 4.50,
    badge: 'Importado',
    image: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=500&auto=format&fit=crop&q=80',
    description: 'Tubo de Papas Pringles crujientes importadas sabor a elegir (Original / Queso).'
  },
  {
    id: 'snk-2',
    title: 'Doritos Nacho Cheese Gigante (245g)',
    category: 'delicateses',
    price: 5.00,
    badge: 'Snack VIP',
    image: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=500&auto=format&fit=crop&q=80',
    description: 'Bolsa familiar de Doritos sabor a Queso Nacho crujiente para compartir.'
  },
  {
    id: 'snk-3',
    title: 'Maní Salado / Mixto Kraks (200g)',
    category: 'delicateses',
    price: 3.50,
    badge: 'Picoteo',
    image: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=500&auto=format&fit=crop&q=80',
    description: 'Maní salado tostado de alta calidad ideal para acompañar con cervezas o ron.'
  },

  // COMBOS BODEGÓN
  {
    id: 'cm-1',
    title: 'Combo Ronero Ato\'z (Ron + Hielo + Refresco)',
    category: 'combos',
    price: 32.00,
    badge: 'AHORRO VIP',
    image: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=500&auto=format&fit=crop&q=80',
    description: '1 Botella Cacique Leyenda + 1 Bolsa Hielo 3kg + 2 Coca-Colas 1.5L + Vasos plásticos.'
  },
  {
    id: 'cm-2',
    title: 'Combo Cervecero Rumbero (Tobo Zulia + Snacks)',
    category: 'combos',
    price: 25.00,
    badge: 'Cervezas + Snacks',
    image: 'https://images.unsplash.com/photo-1608270586620-248524c67de9?w=500&auto=format&fit=crop&q=80',
    description: '1 Tobo Zulia (10 cervezas heladas) + 1 Papas Pringles + 1 Maní Salado Kraks.'
  }
];

// WHATSAPP CONFIG
const WHATSAPP_PHONE = '584120000000';
const DELIVERY_FEE = 2.00;

// 2. STATE MANAGEMENT
let cartState = [];
let currentCategory = 'all';
let searchQuery = '';

// 3. DOM ELEMENTS
const productGrid = document.getElementById('product-grid');
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search-btn');
const categoryTabs = document.getElementById('category-tabs');

const openCartBtn = document.getElementById('open-cart-btn');
const closeCartBtn = document.getElementById('close-cart-btn');
const cartDrawer = document.getElementById('cart-drawer');
const cartOverlay = document.getElementById('cart-drawer-overlay');

const emptyCartView = document.getElementById('empty-cart-view');
const cartItemsList = document.getElementById('cart-items-list');
const checkoutForm = document.getElementById('checkout-form');
const cartFooter = document.getElementById('cart-footer');

const cartBadgeCount = document.getElementById('cart-badge-count');
const mobileBadgeCount = document.getElementById('mobile-badge-count');
const cartItemsCountText = document.getElementById('cart-items-count-text');

const cartSubtotal = document.getElementById('cart-subtotal');
const cartDeliveryFee = document.getElementById('cart-delivery-fee');
const cartTotal = document.getElementById('cart-total');

const whatsappOrderBtn = document.getElementById('whatsapp-order-btn');
const startShoppingBtn = document.getElementById('start-shopping-btn');
const toastContainer = document.getElementById('toast-container');

const mobileSearchTrigger = document.getElementById('mobile-search-trigger');
const mobileCartTrigger = document.getElementById('mobile-cart-trigger');

// 4. INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
  loadCartFromStorage();
  renderProducts();
  bindEvents();
  initHero3DTilt();
});

// 5. RENDER PRODUCTS WITH 3D TILT ENGINE
function renderProducts() {
  const filtered = PRODUCTS.filter(product => {
    const matchesCategory = currentCategory === 'all' || product.category === currentCategory;
    const matchesSearch = product.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          product.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  if (filtered.length === 0) {
    productGrid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px;">
        <i class="fa-solid fa-wine-bottle" style="font-size: 48px; color: var(--gold-glow); margin-bottom: 16px;"></i>
        <h4 style="font-size: 18px; font-weight: 800; margin-bottom: 8px;">No encontramos licores con ese término</h4>
        <p style="font-size: 13px; color: var(--text-muted);">Intenta buscando por ron, whisky, cerveza, tobo o combos.</p>
      </div>
    `;
    return;
  }

  productGrid.innerHTML = filtered.map(product => `
    <div class="product-card-3d-wrapper">
      <div class="product-card" data-tilt-card data-id="${product.id}">
        <div class="product-card-glare"></div>
        <div class="product-image-container">
          <span class="product-badge">${product.badge}</span>
          <img src="${product.image}" alt="${product.title}" class="product-image" loading="lazy">
        </div>
        <div class="product-info">
          <h4 class="product-title">${product.title}</h4>
          <p class="product-desc">${product.description}</p>
          <div class="product-footer">
            <div class="product-price">
              <span class="price-currency">USD</span>
              <span class="price-value">$${product.price.toFixed(2)}</span>
            </div>
            <button class="add-to-cart-btn" onclick="addToCart('${product.id}')" aria-label="Agregar al carrito">
              <i class="fa-solid fa-plus"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  `).join('');

  bind3DTiltCards();
}

// 6. 3D TILT PARALLAX ENGINE
function bind3DTiltCards() {
  const cards = document.querySelectorAll('[data-tilt-card]');
  
  cards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      const rotateX = ((y - centerY) / centerY) * -12;
      const rotateY = ((x - centerX) / centerX) * 12;

      const glareX = (x / rect.width) * 100;
      const glareY = (y / rect.height) * 100;

      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
      card.style.setProperty('--card-glare-x', `${glareX}%`);
      card.style.setProperty('--card-glare-y', `${glareY}%`);
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
    });

    card.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        const rect = card.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        const rotateX = ((y - centerY) / centerY) * -8;
        const rotateY = ((x - centerX) / centerX) * 8;

        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
      }
    }, { passive: true });

    card.addEventListener('touchend', () => {
      card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)';
    });
  });
}

function initHero3DTilt() {
  const heroCard = document.getElementById('hero-tilt-card');
  if (!heroCard) return;

  heroCard.addEventListener('mousemove', (e) => {
    const rect = heroCard.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    const rotateX = ((y - centerY) / centerY) * -8;
    const rotateY = ((x - centerX) / centerX) * 8;

    heroCard.style.transform = `perspective(1200px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    heroCard.style.setProperty('--glare-x', `${(x / rect.width) * 100}%`);
    heroCard.style.setProperty('--glare-y', `${(y / rect.height) * 100}%`);
  });

  heroCard.addEventListener('mouseleave', () => {
    heroCard.style.transform = 'perspective(1200px) rotateX(0deg) rotateY(0deg)';
  });
}

// 7. CART STATE & LOCALSTORAGE
function addToCart(productId) {
  const product = PRODUCTS.find(p => p.id === productId);
  if (!product) return;

  const existing = cartState.find(item => item.id === productId);
  if (existing) {
    existing.quantity += 1;
  } else {
    cartState.push({
      id: product.id,
      title: product.title,
      price: product.price,
      image: product.image,
      quantity: 1
    });
  }

  saveCartToStorage();
  updateCartUI();
  showToast(`¡${product.title} agregado al carrito!`);
}

function updateQuantity(productId, delta) {
  const item = cartState.find(i => i.id === productId);
  if (!item) return;

  item.quantity += delta;
  if (item.quantity <= 0) {
    cartState = cartState.filter(i => i.id !== productId);
  }

  saveCartToStorage();
  updateCartUI();
}

function saveCartToStorage() {
  localStorage.setItem('atoz_cart', JSON.stringify(cartState));
}

function loadCartFromStorage() {
  try {
    const saved = localStorage.getItem('atoz_cart');
    if (saved) {
      cartState = JSON.parse(saved);
      updateCartUI();
    }
  } catch (_) {}
}

function updateCartUI() {
  const totalItemsCount = cartState.reduce((sum, i) => sum + i.quantity, 0);
  
  cartBadgeCount.textContent = totalItemsCount;
  mobileBadgeCount.textContent = totalItemsCount;
  cartItemsCountText.textContent = `${totalItemsCount} producto${totalItemsCount === 1 ? '' : 's'}`;

  if (cartState.length === 0) {
    emptyCartView.style.display = 'block';
    cartItemsList.style.display = 'none';
    checkoutForm.style.display = 'none';
    cartFooter.style.display = 'none';
    return;
  }

  emptyCartView.style.display = 'none';
  cartItemsList.style.display = 'block';
  checkoutForm.style.display = 'block';
  cartFooter.style.display = 'block';

  cartItemsList.innerHTML = cartState.map(item => `
    <div class="cart-item">
      <img src="${item.image}" alt="${item.title}" class="cart-item-img">
      <div class="cart-item-details">
        <p class="cart-item-title">${item.title}</p>
        <p class="cart-item-price">$${(item.price * item.quantity).toFixed(2)}</p>
      </div>
      <div class="cart-item-controls">
        <button class="qty-btn" onclick="updateQuantity('${item.id}', -1)"><i class="fa-solid fa-minus"></i></button>
        <span class="qty-val">${item.quantity}</span>
        <button class="qty-btn" onclick="updateQuantity('${item.id}', 1)"><i class="fa-solid fa-plus"></i></button>
      </div>
    </div>
  `).join('');

  const subtotal = cartState.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const total = subtotal + DELIVERY_FEE;

  cartSubtotal.textContent = `$${subtotal.toFixed(2)}`;
  cartDeliveryFee.textContent = `$${DELIVERY_FEE.toFixed(2)}`;
  cartTotal.textContent = `$${total.toFixed(2)}`;
}

// 8. WHATSAPP ORDER DISPATCH ENGINE
function sendWhatsAppOrder() {
  if (cartState.length === 0) {
    showToast('Tu carrito está vacío', 'warning');
    return;
  }

  const name = document.getElementById('customer-name').value.trim();
  const phone = document.getElementById('customer-phone').value.trim();
  const address = document.getElementById('customer-address').value.trim();
  const payment = document.getElementById('payment-method').value;
  const notes = document.getElementById('order-notes').value.trim();

  if (!name || !phone || !address) {
    showToast('Por favor completa Nombre, Teléfono y Dirección de entrega', 'warning');
    if (!name) document.getElementById('customer-name').focus();
    else if (!phone) document.getElementById('customer-phone').focus();
    else if (!address) document.getElementById('customer-address').focus();
    return;
  }

  const subtotal = cartState.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const total = subtotal + DELIVERY_FEE;

  let message = `🍷 *NUEVO PEDIDO BODEGÓN & MARKET - ATO'Z* 🍷\n`;
  message += `📜 *RIF: J-500277490* | "Más que un Bodegón"\n`;
  message += `----------------------------------\n`;
  message += `👤 *Cliente:* ${name}\n`;
  message += `📞 *Teléfono:* ${phone}\n`;
  message += `📍 *Dirección de Entrega:* ${address}\n`;
  message += `💳 *Método de Pago:* ${payment}\n\n`;
  
  message += `🛒 *LICORES Y BOTELLAS SOLICITADAS:*\n`;
  cartState.forEach(item => {
    message += `• ${item.quantity}x ${item.title} ($${(item.price * item.quantity).toFixed(2)})\n`;
  });

  message += `\n----------------------------------\n`;
  message += `💵 *Subtotal:* $${subtotal.toFixed(2)}\n`;
  message += `🛵 *Delivery:* $${DELIVERY_FEE.toFixed(2)}\n`;
  message += `🏆 *TOTAL A PAGAR:* $${total.toFixed(2)}\n`;
  message += `----------------------------------\n`;

  if (notes) {
    message += `💬 *Indicaciones:* ${notes}\n`;
  }

  message += `\n¡Quedo a la espera de la confirmación de mi pedido!🚀`;

  const encodedUrl = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(message)}`;
  window.open(encodedUrl, '_blank');
}

// 9. EVENT BINDINGS
function bindEvents() {
  categoryTabs.addEventListener('click', (e) => {
    const btn = e.target.closest('.cat-tab');
    if (!btn) return;

    document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');

    currentCategory = btn.dataset.category;
    renderProducts();
  });

  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    clearSearchBtn.style.display = searchQuery ? 'block' : 'none';
    renderProducts();
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    clearSearchBtn.style.display = 'none';
    renderProducts();
  });

  openCartBtn.addEventListener('click', openCart);
  mobileCartTrigger.addEventListener('click', openCart);

  closeCartBtn.addEventListener('click', closeCart);
  cartOverlay.addEventListener('click', closeCart);

  if (startShoppingBtn) {
    startShoppingBtn.addEventListener('click', () => {
      closeCart();
      window.location.hash = '#menu-catalog';
    });
  }

  if (mobileSearchTrigger) {
    mobileSearchTrigger.addEventListener('click', () => {
      searchInput.focus();
      window.location.hash = '#menu-catalog';
    });
  }

  whatsappOrderBtn.addEventListener('click', sendWhatsAppOrder);
}

function openCart() {
  cartDrawer.classList.add('active');
  cartOverlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeCart() {
  cartDrawer.classList.remove('active');
  cartOverlay.classList.remove('active');
  document.body.style.overflow = '';
}

// 10. TOAST NOTIFICATION UTILITY
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = 'toast';
  
  const icon = type === 'success' 
    ? '<i class="fa-solid fa-circle-check color-gold"></i>' 
    : '<i class="fa-solid fa-circle-exclamation color-gold"></i>';
    
  toast.innerHTML = `${icon} <span>${message}</span>`;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slide-in 0.3s ease-out reverse forwards';
    setTimeout(() => toast.remove(), 300);
  }, 2800);
}
