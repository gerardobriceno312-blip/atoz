/**
 * ============================================================================
 * BODEGÓN & MARKET ATO'Z - SISTEMA ADMINISTRATIVO Y CAJA (SÚPER SENCILLO)
 * Usuario Admin: dzara | Contraseña: dzara
 * ============================================================================
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'ATOZ_SIMPLE_SYSTEM_V2';
  const SESSION_KEY = 'ATOZ_SIMPLE_SESSION_V2';

  let state = {
    exchangeRate: 1000,
    payMethod: 'punto',
    users: [
      { id: 'u1', fullName: 'David Zara', username: 'dzara', password: 'dzara', role: 'ADMIN' },
      { id: 'u2', fullName: 'Cajero Turno', username: 'cajero1', password: '1234', role: 'CAJERO' }
    ],
    products: [],
    clients: [],
    dailySales: [],
    closures: []
  };

  let currentUser = null;
  let invPage = 1;
  const PAGE_SIZE = 50;

  // ==========================================================================
  // 1. INICIO Y ALMACENAMIENTO
  // ==========================================================================
  function init() {
    loadState();
    bindEvents();
    checkSession();
  }

  function loadState() {
    const saved = localStorage.getItem(STORAGE_KEY);
    const initial = window.ATOZ_INITIAL_DATA || {};

    if (saved) {
      try {
        state = Object.assign({}, state, JSON.parse(saved));
        if (!state.users.some(u => u.username.toLowerCase() === 'dzara')) {
          state.users.unshift({ id: 'u1', fullName: 'David Zara', username: 'dzara', password: 'dzara', role: 'ADMIN' });
        }
        return;
      } catch (e) {
        console.warn(e);
      }
    }

    state.exchangeRate = initial.defaultExchangeRate || 1000;
    state.products = JSON.parse(JSON.stringify(initial.products || []));
    state.clients = JSON.parse(JSON.stringify(initial.clients || []));
    state.dailySales = JSON.parse(JSON.stringify(initial.dailySales || []));
    saveState();
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function checkSession() {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) {
      try {
        const u = JSON.parse(raw);
        const valid = state.users.find(x => x.username.toLowerCase() === u.username.toLowerCase());
        if (valid) {
          currentUser = valid;
          openApp();
          return;
        }
      } catch (e) {}
    }
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('app-shell').classList.add('hidden');
  }

  function openApp() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app-shell').classList.remove('hidden');

    document.getElementById('active-user-badge').textContent = `${currentUser.role}: ${currentUser.fullName}`;
    document.getElementById('cierre-user-label').textContent = `Cajero: ${currentUser.fullName}`;
    document.getElementById('global-rate-input').value = state.exchangeRate;

    document.querySelectorAll('.admin-only').forEach(el => {
      el.classList.toggle('hidden', currentUser.role !== 'ADMIN');
    });

    renderAll();
  }

  function renderAll() {
    renderDatalists();
    renderQuickButtons();
    updateLiveTotal();
    renderSalesTable();
    renderCierreView();
    renderClientsView();
    renderInventoryView();
    renderCashiersView();
  }

  // ==========================================================================
  // 2. CAJA DIARIA (SÚPER FÁCIL)
  // ==========================================================================
  function renderDatalists() {
    document.getElementById('datalist-products').innerHTML = state.products
      .map(p => `<option value="${esc(p.name)}">$${Number(p.price).toFixed(2)}</option>`)
      .join('');

    document.getElementById('datalist-clients').innerHTML = state.clients
      .map(c => `<option value="${esc(c.name)}">${c.deuda > 0 ? 'Debe $' + c.deuda : ''}</option>`)
      .join('');
  }

  function renderQuickButtons() {
    const grid = document.getElementById('quick-products-grid');
    const quicks = state.products.filter(p => p.quick);
    grid.innerHTML = quicks
      .map(
        p => `
      <button type="button" class="q-btn" data-name="${esc(p.name)}" data-price="${p.price}">
        <strong>${esc(p.name)}</strong>
        <span>$${Number(p.price).toFixed(2)}</span>
      </button>
    `
      )
      .join('');

    grid.querySelectorAll('.q-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const name = btn.getAttribute('data-name');
        const price = parseFloat(btn.getAttribute('data-price')) || 0;
        const pInput = document.getElementById('entry-product');
        const qInput = document.getElementById('entry-qty');

        if (pInput.value === name) {
          qInput.value = (parseFloat(qInput.value) || 1) + 1;
        } else {
          pInput.value = name;
          qInput.value = 1;
          document.getElementById('entry-price').value = price.toFixed(2);
        }
        updateLiveTotal();
      });
    });
  }

  function updateLiveTotal() {
    const qty = parseFloat(document.getElementById('entry-qty').value) || 0;
    const price = parseFloat(document.getElementById('entry-price').value) || 0;
    const totalUsd = round2(qty * price);
    const totalBs = round2(totalUsd * (parseFloat(state.exchangeRate) || 1000));

    document.getElementById('display-total-usd').textContent = `$${fmt(totalUsd, 2)}`;
    document.getElementById('display-total-bs').textContent = `${fmt(totalBs, 0)} Bs`;
  }

  function getTotals() {
    const t = { usd: 0, pmBs: 0, divUsd: 0, efBs: 0, puntoBs: 0, zelleUsd: 0, pendUsd: 0, abonUsd: 0 };
    state.dailySales.forEach(s => {
      t.usd += Number(s.totalUsd) || 0;
      t.pmBs += Number(s.pagoMovilBs) || 0;
      t.divUsd += Number(s.divisasUsd) || 0;
      t.efBs += Number(s.efectivoBs) || 0;
      t.puntoBs += Number(s.puntoBs) || 0;
      t.zelleUsd += Number(s.zelleUsd) || 0;
      t.pendUsd += Number(s.pendienteUsd) || 0;
      t.abonUsd += Number(s.abonadoUsd) || 0;
    });
    return t;
  }

  function renderSalesTable() {
    const t = getTotals();
    document.getElementById('sum-total-usd').textContent = `$${fmt(t.usd, 2)}`;
    document.getElementById('sum-punto-bs').textContent = `${fmt(t.puntoBs, 0)} Bs`;
    document.getElementById('sum-pm-bs').textContent = `${fmt(t.pmBs, 0)} Bs`;
    document.getElementById('sum-divisas-usd').textContent = `$${fmt(t.divUsd, 2)}`;
    document.getElementById('sum-ef-zelle').textContent = `${fmt(t.efBs, 0)} Bs / $${fmt(t.zelleUsd, 2)}`;
    document.getElementById('sum-pendiente-usd').textContent = `$${fmt(t.pendUsd, 2)}`;

    const search = (document.getElementById('search-sales').value || '').toLowerCase();
    const list = state.dailySales.filter(s => {
      if (!search) return true;
      return (s.product || '').toLowerCase().includes(search) || (s.client || '').toLowerCase().includes(search);
    });

    const tbody = document.getElementById('sales-tbody');
    tbody.innerHTML = list
      .map(
        s => `
      <tr class="${s.highlight ? 'row-yellow' : ''}">
        <td style="text-align:left;"><strong>${esc(s.product)}</strong></td>
        <td>${s.qty ?? ''}</td>
        <td>$${fmt(s.price, 2)}</td>
        <td><strong>$${fmt(s.totalUsd, 2)}</strong></td>
        <td>$${fmt(s.totalConsumoUsd || s.totalUsd, 2)}</td>
        <td>${s.pagoMovilBs > 0 ? fmt(s.pagoMovilBs, 0) : ''}</td>
        <td>${s.divisasUsd > 0 ? '$' + fmt(s.divisasUsd, 2) : ''}</td>
        <td>${s.efectivoBs > 0 ? fmt(s.efectivoBs, 0) : ''}</td>
        <td>${s.puntoBs > 0 ? fmt(s.puntoBs, 0) : ''}</td>
        <td>${s.zelleUsd > 0 ? '$' + fmt(s.zelleUsd, 2) : ''}</td>
        <td style="text-align:left;"><strong>${esc(s.client || '')}</strong></td>
        <td>${s.pendienteUsd > 0 ? '$' + fmt(s.pendienteUsd, 2) : ''}</td>
        <td>${s.abonadoUsd > 0 ? '$' + fmt(s.abonadoUsd, 2) : ''}</td>
        <td>
          <button type="button" class="mini-btn btn-hl" data-id="${s.id}" title="Amarillo"><i class="fa-solid fa-highlighter"></i></button>
          <button type="button" class="mini-btn btn-del" data-id="${s.id}" title="Borrar"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>
    `
      )
      .join('');

    document.getElementById('sales-tfoot').innerHTML = `
      <tr>
        <td colspan="3" style="text-align:left;">TOTALES DEL DÍA</td>
        <td>$${fmt(t.usd, 2)}</td>
        <td>$${fmt(t.usd, 2)}</td>
        <td>${fmt(t.pmBs, 0)} Bs</td>
        <td>$${fmt(t.divUsd, 2)}</td>
        <td>${fmt(t.efBs, 0)} Bs</td>
        <td>${fmt(t.puntoBs, 0)} Bs</td>
        <td>$${fmt(t.zelleUsd, 2)}</td>
        <td></td>
        <td>$${fmt(t.pendUsd, 2)}</td>
        <td>$${fmt(t.abonUsd, 2)}</td>
        <td></td>
      </tr>
    `;

    tbody.querySelectorAll('.btn-hl').forEach(b => {
      b.addEventListener('click', () => {
        const item = state.dailySales.find(x => x.id === b.getAttribute('data-id'));
        if (item) {
          item.highlight = !item.highlight;
          saveState();
          renderSalesTable();
        }
      });
    });

    tbody.querySelectorAll('.btn-del').forEach(b => {
      b.addEventListener('click', () => {
        state.dailySales = state.dailySales.filter(x => x.id !== b.getAttribute('data-id'));
        saveState();
        renderSalesTable();
        renderCierreView();
      });
    });
  }

  // ==========================================================================
  // 3. CIERRE DE CAJA
  // ==========================================================================
  function renderCierreView() {
    const t = getTotals();
    const totalBs = t.puntoBs + t.pmBs + t.efBs;
    const totalDiv = t.divUsd + t.zelleUsd;

    document.getElementById('cierre-total-usd').textContent = `$${fmt(t.usd, 2)}`;
    document.getElementById('cierre-total-bs').textContent = `${fmt(totalBs, 0)} Bs`;
    document.getElementById('cierre-total-divisas').textContent = `$${fmt(totalDiv, 2)}`;

    document.getElementById('cierre-line-punto').textContent = `${fmt(t.puntoBs, 0)} Bs`;
    document.getElementById('cierre-line-pm').textContent = `${fmt(t.pmBs, 0)} Bs`;
    document.getElementById('cierre-line-efbs').textContent = `${fmt(t.efBs, 0)} Bs`;
    document.getElementById('cierre-line-divisas').textContent = `$${fmt(t.divUsd, 2)}`;
    document.getElementById('cierre-line-zelle').textContent = `$${fmt(t.zelleUsd, 2)}`;
    document.getElementById('cierre-line-pendiente').textContent = `$${fmt(t.pendUsd, 2)}`;
    document.getElementById('cierre-line-abonado').textContent = `$${fmt(t.abonUsd, 2)}`;

    const clList = document.getElementById('closures-list');
    if (!state.closures.length) {
      clList.innerHTML = `<p class="hint">Aún no hay cierres guardados.</p>`;
      return;
    }

    clList.innerHTML = state.closures
      .map(
        c => `
      <div class="closure-item">
        <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
          <strong class="text-gold">${esc(c.date)}</strong>
          <strong>Total: $${fmt(c.totalUsd, 2)}</strong>
        </div>
        <div style="font-size:13px; color:var(--muted);">
          Cajero: ${esc(c.cashier)} • Punto: ${fmt(c.puntoBs, 0)} Bs • Pago Móvil: ${fmt(c.pmBs, 0)} Bs • Divisas: $${fmt(c.divUsd, 2)}
        </div>
        ${c.nota ? `<div style="font-size:12.5px; margin-top:4px; color:var(--gold);">Nota: ${esc(c.nota)}</div>` : ''}
      </div>
    `
      )
      .join('');
  }

  // ==========================================================================
  // 4. CLIENTES (DEUDAS Y ABONOS)
  // ==========================================================================
  function renderClientsView() {
    let sumDeuda = 0;
    let sumFavor = 0;
    state.clients.forEach(c => {
      sumDeuda += Number(c.deuda) || 0;
      sumFavor += Number(c.aFavor) || 0;
    });

    document.getElementById('cli-sum-deuda').textContent = `$${fmt(sumDeuda, 2)}`;
    document.getElementById('cli-sum-favor').textContent = `$${fmt(sumFavor, 2)}`;
    document.getElementById('cli-sum-count').textContent = state.clients.length;

    const search = (document.getElementById('search-clients').value || '').toLowerCase();
    const filter = document.getElementById('filter-clients').value;

    const list = state.clients.filter(c => {
      if (search && !(c.name || '').toLowerCase().includes(search)) return false;
      if (filter === 'DEUDA') return (c.deuda || 0) > 0;
      if (filter === 'FAVOR') return (c.aFavor || 0) > 0;
      return true;
    });

    const tbody = document.getElementById('clients-tbody');
    tbody.innerHTML = list
      .map(
        c => `
      <tr>
        <td style="text-align:left;"><strong>${esc(c.name)}</strong></td>
        <td>${c.deuda > 0 ? `<strong class="text-yellow">$${fmt(c.deuda, 2)}</strong>` : '$0.00'}</td>
        <td>${c.aFavor > 0 ? `<strong class="text-green">$${fmt(c.aFavor, 2)}</strong>` : '$0.00'}</td>
        <td>${c.deuda > 0 ? '<span class="text-yellow">PENDIENTE</span>' : c.aFavor > 0 ? '<span class="text-green">A FAVOR</span>' : 'AL DÍA'}</td>
        <td>
          <button type="button" class="btn-gold btn-abonar" data-id="${c.id}" style="padding:6px 12px; font-size:12.5px;">
            Abonar / Pagar
          </button>
        </td>
      </tr>
    `
      )
      .join('');

    tbody.querySelectorAll('.btn-abonar').forEach(btn => {
      btn.addEventListener('click', () => {
        const c = state.clients.find(x => x.id === btn.getAttribute('data-id'));
        if (!c) return;
        document.getElementById('abono-cli-id').value = c.id;
        document.getElementById('abono-modal-title').textContent = `Abonar a: ${c.name}`;
        document.getElementById('abono-monto').value = c.deuda > 0 ? c.deuda : '';
        document.getElementById('abono-modal').classList.remove('hidden');
      });
    });
  }

  // ==========================================================================
  // 5. PRECIOS E INVENTARIO
  // ==========================================================================
  function renderInventoryView() {
    const search = (document.getElementById('search-inv').value || '').toLowerCase();
    const cat = document.getElementById('filter-inv-cat').value;
    const rate = parseFloat(state.exchangeRate) || 1000;

    const filtered = state.products.filter(p => {
      if (search && !(p.name || '').toLowerCase().includes(search)) return false;
      if (cat === 'QUICK') return Boolean(p.quick);
      if (cat !== 'ALL' && p.category !== cat) return false;
      return true;
    });

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (invPage > totalPages) invPage = 1;
    const items = filtered.slice((invPage - 1) * PAGE_SIZE, invPage * PAGE_SIZE);

    const isAdmin = currentUser && currentUser.role === 'ADMIN';
    const tbody = document.getElementById('inv-tbody');
    tbody.innerHTML = items
      .map(
        p => `
      <tr>
        <td style="text-align:left;"><strong>${esc(p.name)}</strong></td>
        <td>${esc(p.category)}</td>
        <td><strong class="text-gold">$${fmt(p.price, 2)}</strong></td>
        <td>${fmt(p.price * rate, 0)} Bs</td>
        <td>${p.stock ?? 0}</td>
        <td>
          <button type="button" class="mini-btn btn-star" data-id="${p.id}">
            <i class="fa-${p.quick ? 'solid' : 'regular'} fa-star ${p.quick ? 'text-yellow' : ''}"></i>
          </button>
        </td>
        <td class="${isAdmin ? '' : 'hidden'}">
          <button type="button" class="mini-btn btn-price-edit" data-id="${p.id}" title="Cambiar Precio">
            <i class="fa-solid fa-pen"></i> Precio
          </button>
        </td>
      </tr>
    `
      )
      .join('');

    document.getElementById('inv-pager').innerHTML = `
      <span class="hint">Mostrando ${items.length} de ${filtered.length} productos (Pág. ${invPage}/${totalPages})</span>
      <div style="display:flex; gap:8px;">
        <button type="button" class="btn-secondary" id="prev-p" ${invPage <= 1 ? 'disabled' : ''}>Anterior</button>
        <button type="button" class="btn-secondary" id="next-p" ${invPage >= totalPages ? 'disabled' : ''}>Siguiente</button>
      </div>
    `;

    document.getElementById('prev-p')?.addEventListener('click', () => { if (invPage > 1) { invPage--; renderInventoryView(); } });
    document.getElementById('next-p')?.addEventListener('click', () => { if (invPage < totalPages) { invPage++; renderInventoryView(); } });

    tbody.querySelectorAll('.btn-star').forEach(b => {
      b.addEventListener('click', () => {
        const p = state.products.find(x => x.id === b.getAttribute('data-id'));
        if (p) {
          p.quick = !p.quick;
          saveState();
          renderInventoryView();
          renderQuickButtons();
        }
      });
    });

    tbody.querySelectorAll('.btn-price-edit').forEach(b => {
      b.addEventListener('click', () => {
        const p = state.products.find(x => x.id === b.getAttribute('data-id'));
        if (!p) return;
        const nuevo = prompt(`Nuevo precio en dólares ($) para ${p.name}:`, p.price);
        if (nuevo !== null && !isNaN(parseFloat(nuevo))) {
          p.price = round2(parseFloat(nuevo));
          saveState();
          renderInventoryView();
          renderQuickButtons();
          renderDatalists();
          toast(`Precio de ${p.name} actualizado a $${p.price.toFixed(2)}`);
        }
      });
    });
  }

  // ==========================================================================
  // 6. CAJEROS (SOLO ADMIN dzara)
  // ==========================================================================
  function renderCashiersView() {
    const tbody = document.getElementById('cashiers-tbody');
    if (!tbody) return;
    tbody.innerHTML = state.users
      .map(
        u => `
      <tr>
        <td style="text-align:left;"><strong>${esc(u.fullName)}</strong></td>
        <td><strong class="text-gold">${esc(u.username)}</strong></td>
        <td>${esc(u.password)}</td>
        <td>${u.role}</td>
        <td>
          ${
            u.username.toLowerCase() !== 'dzara'
              ? `<button type="button" class="mini-btn btn-del-usr" data-id="${u.id}"><i class="fa-solid fa-trash"></i></button>`
              : ''
          }
        </td>
      </tr>
    `
      )
      .join('');

    tbody.querySelectorAll('.btn-del-usr').forEach(b => {
      b.addEventListener('click', () => {
        state.users = state.users.filter(x => x.id !== b.getAttribute('data-id'));
        saveState();
        renderCashiersView();
        toast('Cajero eliminado');
      });
    });
  }

  // ==========================================================================
  // 7. EVENTOS
  // ==========================================================================
  function bindEvents() {
    // Login
    document.getElementById('login-form').addEventListener('submit', e => {
      e.preventDefault();
      const u = document.getElementById('login-username').value.trim();
      const p = document.getElementById('login-password').value.trim();
      const found = state.users.find(x => x.username.toLowerCase() === u.toLowerCase() && x.password === p);
      if (!found) {
        document.getElementById('login-error').classList.remove('hidden');
        return;
      }
      document.getElementById('login-error').classList.add('hidden');
      currentUser = found;
      localStorage.setItem(SESSION_KEY, JSON.stringify(found));
      openApp();
    });

    // Salir
    document.getElementById('logout-btn').addEventListener('click', () => {
      localStorage.removeItem(SESSION_KEY);
      currentUser = null;
      checkSession();
    });

    // Navegación
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`tab-${tab}`).classList.add('active');
        if (tab === 'cierre') renderCierreView();
      });
    });

    // Tasa del Día
    document.getElementById('global-rate-input').addEventListener('input', e => {
      const r = parseFloat(e.target.value);
      if (r > 0) {
        state.exchangeRate = r;
        saveState();
        updateLiveTotal();
        renderInventoryView();
      }
    });

    // Autocompletar precio al escribir producto
    document.getElementById('entry-product').addEventListener('input', e => {
      const val = e.target.value.trim().toLowerCase();
      const found = state.products.find(p => p.name.toLowerCase() === val);
      if (found) {
        document.getElementById('entry-price').value = Number(found.price).toFixed(2);
        updateLiveTotal();
      }
    });

    // Cantidad + / -
    document.getElementById('qty-minus').addEventListener('click', () => {
      const inp = document.getElementById('entry-qty');
      inp.value = Math.max(1, (parseFloat(inp.value) || 1) - 1);
      updateLiveTotal();
    });
    document.getElementById('qty-plus').addEventListener('click', () => {
      const inp = document.getElementById('entry-qty');
      inp.value = (parseFloat(inp.value) || 0) + 1;
      updateLiveTotal();
    });
    document.getElementById('entry-qty').addEventListener('input', updateLiveTotal);
    document.getElementById('entry-price').addEventListener('input', updateLiveTotal);

    // Botones de Método de Pago
    document.querySelectorAll('.pay-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.payMethod = btn.getAttribute('data-pay');
        document.querySelectorAll('.pay-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('entry-highlight').checked = state.payMethod === 'pendiente';
      });
    });

    // Registrar Venta en 1 Clic
    document.getElementById('sale-form').addEventListener('submit', e => {
      e.preventDefault();
      const product = document.getElementById('entry-product').value.trim().toUpperCase();
      const qty = parseFloat(document.getElementById('entry-qty').value) || 1;
      const price = parseFloat(document.getElementById('entry-price').value) || 0;
      const totalUsd = round2(qty * price);
      const rate = parseFloat(state.exchangeRate) || 1000;
      const totalBs = round2(totalUsd * rate);
      const client = document.getElementById('entry-client').value.trim().toUpperCase();
      const highlight = document.getElementById('entry-highlight').checked || state.payMethod === 'pendiente';

      const sale = {
        id: `s-${Date.now()}`,
        product,
        qty,
        price,
        totalUsd,
        totalConsumoUsd: totalUsd,
        pagoMovilBs: state.payMethod === 'pagomovil' ? totalBs : 0,
        divisasUsd: state.payMethod === 'divisas' ? totalUsd : 0,
        efectivoBs: state.payMethod === 'efectivobs' ? totalBs : 0,
        puntoBs: state.payMethod === 'punto' ? totalBs : 0,
        zelleUsd: state.payMethod === 'zelle' ? totalUsd : 0,
        client,
        pendienteUsd: state.payMethod === 'pendiente' ? totalUsd : 0,
        abonadoUsd: 0,
        highlight
      };

      state.dailySales.unshift(sale);

      // Si es fiado/pendiente y puso cliente, sumarlo a su deuda
      if (state.payMethod === 'pendiente' && client) {
        let c = state.clients.find(x => x.name.toUpperCase() === client);
        if (!c) {
          c = { id: `c-${Date.now()}`, name: client, deuda: 0, aFavor: 0, note: 'PENDIENTE' };
          state.clients.unshift(c);
        }
        c.deuda = round2((c.deuda || 0) + totalUsd);
      }

      saveState();
      document.getElementById('entry-product').value = '';
      document.getElementById('entry-qty').value = 1;
      document.getElementById('entry-price').value = '';
      document.getElementById('entry-client').value = '';
      updateLiveTotal();
      renderSalesTable();
      renderClientsView();
      toast(`Registrado: ${qty}x ${product} ($${totalUsd.toFixed(2)})`);
    });

    // Buscar y exportar en Hoja Diaria
    document.getElementById('search-sales').addEventListener('input', renderSalesTable);

    document.getElementById('clear-day-btn').addEventListener('click', () => {
      if (confirm('¿Seguro que deseas limpiar la hoja para empezar un nuevo día en cero?')) {
        state.dailySales = [];
        saveState();
        renderSalesTable();
        renderCierreView();
        toast('Hoja en cero lista para el nuevo turno');
      }
    });

    document.getElementById('export-excel-btn').addEventListener('click', () => {
      const headers = ['PRODUCTO', 'CANTIDAD', 'PRECIO', 'TOTAL $', 'TOTAL CONSUMO $', 'PAGO MOVIL', 'DIVISAS', 'EFECTIVO BS', 'PUNTO', 'ZELLE', 'CLIENTE', 'PENDIENTE', 'ABONADO'];
      const rows = state.dailySales.map(s => [
        s.product, s.qty, s.price, s.totalUsd, s.totalConsumoUsd, s.pagoMovilBs, s.divisasUsd, s.efectivoBs, s.puntoBs, s.zelleUsd, s.client, s.pendienteUsd, s.abonadoUsd
      ]);
      const csv = '\uFEFF' + [headers, ...rows].map(r => r.map(v => `"${v ?? ''}"`).join(';')).join('\r\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
      a.download = `Consumo_Diario_Atoz.csv`;
      a.click();
    });

    // Guardar Cierre de Caja
    document.getElementById('cierre-form').addEventListener('submit', e => {
      e.preventDefault();
      const t = getTotals();
      state.closures.unshift({
        id: `cl-${Date.now()}`,
        date: new Date().toLocaleString('es-VE'),
        cashier: currentUser ? currentUser.fullName : 'dzara',
        totalUsd: t.usd,
        puntoBs: t.puntoBs,
        pmBs: t.pmBs,
        efBs: t.efBs,
        divUsd: t.divUsd,
        zelleUsd: t.zelleUsd,
        nota: document.getElementById('cierre-nota').value.trim()
      });
      document.getElementById('cierre-nota').value = '';
      saveState();
      renderCierreView();
      toast('¡Cierre de caja guardado!');
    });

    document.getElementById('print-cierre-btn').addEventListener('click', () => window.print());

    // Clientes
    document.getElementById('search-clients').addEventListener('input', renderClientsView);
    document.getElementById('filter-clients').addEventListener('change', renderClientsView);
    document.getElementById('new-client-btn').addEventListener('click', () => {
      const name = prompt('Nombre del nuevo cliente:');
      if (!name) return;
      const deuda = parseFloat(prompt('¿Tiene deuda inicial en $? (Pon 0 si no debe):', '0')) || 0;
      state.clients.unshift({ id: `c-${Date.now()}`, name: name.trim().toUpperCase(), deuda, aFavor: 0, note: '' });
      saveState();
      renderClientsView();
      renderDatalists();
      toast('Cliente agregado');
    });

    document.getElementById('close-abono-btn').addEventListener('click', () => {
      document.getElementById('abono-modal').classList.add('hidden');
    });

    document.getElementById('abono-form').addEventListener('submit', e => {
      e.preventDefault();
      const id = document.getElementById('abono-cli-id').value;
      const monto = parseFloat(document.getElementById('abono-monto').value) || 0;
      const metodo = document.getElementById('abono-metodo').value;
      const c = state.clients.find(x => x.id === id);
      if (!c || monto <= 0) return;

      if (c.deuda >= monto) {
        c.deuda = round2(c.deuda - monto);
      } else {
        const sobra = round2(monto - c.deuda);
        c.deuda = 0;
        c.aFavor = round2((c.aFavor || 0) + sobra);
      }

      const bs = round2(monto * (parseFloat(state.exchangeRate) || 1000));
      state.dailySales.unshift({
        id: `s-${Date.now()}`,
        product: `ABONO DE ${c.name}`,
        qty: 1,
        price: monto,
        totalUsd: 0,
        totalConsumoUsd: 0,
        pagoMovilBs: metodo === 'pagomovil' ? bs : 0,
        divisasUsd: metodo === 'divisas' ? monto : 0,
        efectivoBs: metodo === 'efectivobs' ? bs : 0,
        puntoBs: metodo === 'punto' ? bs : 0,
        zelleUsd: metodo === 'zelle' ? monto : 0,
        client: c.name,
        pendienteUsd: 0,
        abonadoUsd: monto,
        highlight: false
      });

      saveState();
      document.getElementById('abono-modal').classList.add('hidden');
      renderClientsView();
      renderSalesTable();
      toast(`Abono de $${monto.toFixed(2)} registrado`);
    });

    // Inventario
    document.getElementById('search-inv').addEventListener('input', () => { invPage = 1; renderInventoryView(); });
    document.getElementById('filter-inv-cat').addEventListener('change', () => { invPage = 1; renderInventoryView(); });
    document.getElementById('new-prod-btn').addEventListener('click', () => {
      const name = prompt('Nombre del producto:');
      if (!name) return;
      const price = parseFloat(prompt('Precio de venta en dólares ($):', '1.50')) || 0;
      state.products.unshift({
        id: `p-${Date.now()}`,
        name: name.trim().toUpperCase(),
        category: 'NACIONAL',
        price,
        cost: 0,
        margin: 50,
        stock: 24,
        quick: true
      });
      saveState();
      renderInventoryView();
      renderQuickButtons();
      renderDatalists();
      toast('Producto creado y agregado a botones rápidos');
    });

    // Cajeros
    document.getElementById('cashier-form').addEventListener('submit', e => {
      e.preventDefault();
      state.users.push({
        id: `u-${Date.now()}`,
        fullName: document.getElementById('caj-name').value.trim(),
        username: document.getElementById('caj-user').value.trim(),
        password: document.getElementById('caj-pass').value.trim(),
        role: document.getElementById('caj-role').value
      });
      document.getElementById('cashier-form').reset();
      saveState();
      renderCashiersView();
      toast('Cajero creado con éxito');
    });
  }

  // ==========================================================================
  // 8. UTILIDADES
  // ==========================================================================
  function round2(n) { return Math.round((Number(n) + Number.EPSILON) * 100) / 100; }
  function fmt(n, d = 2) {
    return (Number(n) || 0).toLocaleString('es-VE', { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function toast(msg) {
    const box = document.getElementById('toast-box');
    const d = document.createElement('div');
    d.className = 'toast';
    d.textContent = msg;
    box.appendChild(d);
    setTimeout(() => d.remove(), 2800);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
