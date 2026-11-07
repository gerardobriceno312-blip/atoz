/**
 * ============================================================================
 * BODEGÓN & MARKET ATO'Z - SISTEMA ADMINISTRATIVO, INVENTARIO Y REPORTES
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
    fetchLiveExchangeRates(false);
  }

  // ==========================================================================
  // 1B. ACTUALIZACIÓN AUTOMÁTICA DE TASA DEL DÍA POR API (BCV / PARALELO)
  // ==========================================================================
  let liveRates = { bcv: null, paralelo: null };

  async function fetchLiveExchangeRates(showNotification = true) {
    const icon = document.getElementById('sync-rate-icon');
    if (icon) icon.classList.add('spin');

    try {
      // API Principal: DolarApi Venezuela (BCV Oficial y Paralelo en tiempo real)
      const res = await fetch('https://ve.dolarapi.com/v1/dolares');
      if (!res.ok) throw new Error('Error consultando DolarApi');
      const data = await res.json();

      const oficialObj = Array.isArray(data) ? data.find(d => d.fuente === 'oficial') : null;
      const paraleloObj = Array.isArray(data) ? data.find(d => d.fuente === 'paralelo') : null;

      if (oficialObj && oficialObj.promedio > 0) {
        liveRates.bcv = round2(oficialObj.promedio);
        document.getElementById('lbl-rate-bcv').textContent = liveRates.bcv.toFixed(2);
      }
      if (paraleloObj && paraleloObj.promedio > 0) {
        liveRates.paralelo = round2(paraleloObj.promedio);
        document.getElementById('lbl-rate-par').textContent = liveRates.paralelo.toFixed(2);
      }

      // Si el usuario tenía seleccionado BCV o Paralelo, actualizar automáticamente la tasa activa
      if (state.rateSource === 'bcv' && liveRates.bcv) {
        applyExchangeRate(liveRates.bcv, 'bcv', false);
      } else if (state.rateSource === 'paralelo' && liveRates.paralelo) {
        applyExchangeRate(liveRates.paralelo, 'paralelo', false);
      } else {
        updateRatePillsUI();
      }

      if (showNotification) {
        toast(`Tasas actualizadas por API — BCV: ${liveRates.bcv || '--'} Bs | Paralelo: ${liveRates.paralelo || '--'} Bs`);
      }
    } catch (err) {
      // Fallback API internacional en caso de fallo de red
      try {
        const fallbackRes = await fetch('https://open.er-api.com/v6/latest/USD');
        const fbData = await fallbackRes.json();
        if (fbData && fbData.rates && fbData.rates.VES) {
          liveRates.bcv = round2(fbData.rates.VES);
          document.getElementById('lbl-rate-bcv').textContent = liveRates.bcv.toFixed(2);
          if (showNotification) toast(`Tasa BCV actualizada por API: ${liveRates.bcv} Bs/$`);
        }
      } catch (e2) {
        if (showNotification) toast('No se pudo conectar a la API de tasas en este momento');
      }
    } finally {
      if (icon) icon.classList.remove('spin');
    }
  }

  function applyExchangeRate(newRate, source, notify = true) {
    if (!newRate || newRate <= 0) return;
    state.exchangeRate = round2(newRate);
    state.rateSource = source;
    document.getElementById('global-rate-input').value = state.exchangeRate;
    updateRatePillsUI();
    saveState();
    updateLiveTotal();
    renderInventoryView();
    renderReportsView();
    if (notify) {
      const label = source === 'bcv' ? 'BCV Oficial' : source === 'paralelo' ? 'Paralelo' : 'Manual';
      toast(`Tasa activa cambiada a ${label}: ${state.exchangeRate} Bs/$`);
    }
  }

  function updateRatePillsUI() {
    const bcvBtn = document.getElementById('btn-rate-bcv');
    const parBtn = document.getElementById('btn-rate-par');
    if (bcvBtn) bcvBtn.classList.toggle('active', state.rateSource === 'bcv');
    if (parBtn) parBtn.classList.toggle('active', state.rateSource === 'paralelo');
  }

  function renderAll() {
    renderDatalists();
    renderQuickButtons();
    updateLiveTotal();
    renderSalesTable();
    renderCierreView();
    renderClientsView();
    renderInventoryView();
    renderReportsView();
    renderCashiersView();
  }

  // ==========================================================================
  // 2. CAJA DIARIA
  // ==========================================================================
  function renderDatalists() {
    document.getElementById('datalist-products').innerHTML = state.products
      .map(p => `<option value="${esc(p.name)}">$${Number(p.price).toFixed(2)} (Stock: ${p.stock ?? 0})</option>`)
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
          <button type="button" class="mini-btn btn-hl" data-id="${s.id}" title="Resaltar Amarillo"><i class="fa-solid fa-highlighter"></i></button>
          <button type="button" class="mini-btn btn-del" data-id="${s.id}" title="Borrar"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>
    `
      )
      .join('');

    document.getElementById('sales-tfoot').innerHTML = `
      <tr>
        <td colspan="3" style="text-align:left;">TOTALES DEL DÍA (${state.dailySales.length} ventas)</td>
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
        renderReportsView();
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
  // 5. INVENTARIO Y PRECIOS (CON EDICIÓN DIRECTA DE STOCK Y PRECIO EN TABLA)
  // ==========================================================================
  function renderInventoryView() {
    const search = (document.getElementById('search-inv').value || '').toLowerCase();
    const cat = document.getElementById('filter-inv-cat').value;
    const rate = parseFloat(state.exchangeRate) || 1000;

    document.getElementById('inv-total-label').textContent = state.products.length;

    const filtered = state.products.filter(p => {
      if (search && !(p.name || '').toLowerCase().includes(search)) return false;
      if (cat === 'QUICK') return Boolean(p.quick);
      if (cat === 'LOW_STOCK') return (Number(p.stock) || 0) <= 5;
      if (cat !== 'ALL' && p.category !== cat) return false;
      return true;
    });

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (invPage > totalPages) invPage = 1;
    const items = filtered.slice((invPage - 1) * PAGE_SIZE, invPage * PAGE_SIZE);

    const tbody = document.getElementById('inv-tbody');
    tbody.innerHTML = items
      .map(
        p => `
      <tr>
        <td style="text-align:left;"><strong>${esc(p.name)}</strong></td>
        <td>${esc(p.category)}</td>
        <td>
          <input type="number" step="0.01" min="0" class="inline-price-input" data-id="${p.id}" value="${Number(p.price).toFixed(2)}" title="Cambia el precio y presiona Enter o clic afuera">
        </td>
        <td id="bs-cell-${p.id}"><strong>${fmt(p.price * rate, 0)} Bs</strong></td>
        <td>
          <div class="inline-stock-wrap">
            <button type="button" class="stock-step-btn btn-stk-minus" data-id="${p.id}" title="Restar 1 al Stock">-</button>
            <input type="number" step="any" class="inline-stock-input" data-id="${p.id}" value="${p.stock ?? 0}" title="Escribe la cantidad de stock directamente">
            <button type="button" class="stock-step-btn btn-stk-plus" data-id="${p.id}" title="Sumar 1 al Stock">+</button>
          </div>
        </td>
        <td>
          <button type="button" class="mini-btn btn-star" data-id="${p.id}" title="Mostrar en Caja Rápida">
            <i class="fa-${p.quick ? 'solid' : 'regular'} fa-star ${p.quick ? 'text-yellow' : ''}"></i>
          </button>
        </td>
        <td>
          <button type="button" class="mini-btn btn-open-prod-modal" data-id="${p.id}" title="Editar todos los datos del producto">
            <i class="fa-solid fa-pen-to-square"></i> Editar
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

    // Edición directa de PRECIO ($) en la fila
    tbody.querySelectorAll('.inline-price-input').forEach(inp => {
      inp.addEventListener('change', () => {
        const id = inp.getAttribute('data-id');
        const p = state.products.find(x => x.id === id);
        const val = parseFloat(inp.value);
        if (p && !isNaN(val) && val >= 0) {
          p.price = round2(val);
          inp.value = p.price.toFixed(2);
          const bsCell = document.getElementById(`bs-cell-${p.id}`);
          if (bsCell) bsCell.innerHTML = `<strong>${fmt(p.price * rate, 0)} Bs</strong>`;
          saveState();
          renderQuickButtons();
          renderDatalists();
          renderReportsView();
          toast(`Precio de ${p.name}: $${p.price.toFixed(2)}`);
        }
      });
    });

    // Edición directa de STOCK (escribiendo el número)
    tbody.querySelectorAll('.inline-stock-input').forEach(inp => {
      inp.addEventListener('change', () => {
        const id = inp.getAttribute('data-id');
        const p = state.products.find(x => x.id === id);
        const val = parseFloat(inp.value);
        if (p && !isNaN(val)) {
          p.stock = round2(val);
          saveState();
          renderDatalists();
          renderReportsView();
          toast(`Stock de ${p.name} actualizado a ${p.stock}`);
        }
      });
    });

    // Botones - y + de Stock directo en la fila
    tbody.querySelectorAll('.btn-stk-minus').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const p = state.products.find(x => x.id === id);
        if (p) {
          p.stock = Math.max(0, round2((Number(p.stock) || 0) - 1));
          saveState();
          renderInventoryView();
          renderDatalists();
          renderReportsView();
          toast(`Stock ${p.name}: ${p.stock}`);
        }
      });
    });

    tbody.querySelectorAll('.btn-stk-plus').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const p = state.products.find(x => x.id === id);
        if (p) {
          p.stock = round2((Number(p.stock) || 0) + 1);
          saveState();
          renderInventoryView();
          renderDatalists();
          renderReportsView();
          toast(`Stock ${p.name}: ${p.stock}`);
        }
      });
    });

    // Estrella de Caja Rápida
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

    // Abrir Modal Completo de Editar Producto
    tbody.querySelectorAll('.btn-open-prod-modal').forEach(b => {
      b.addEventListener('click', () => {
        const p = state.products.find(x => x.id === b.getAttribute('data-id'));
        if (!p) return;
        document.getElementById('prod-edit-id').value = p.id;
        document.getElementById('prod-modal-title').textContent = `Editar: ${p.name}`;
        document.getElementById('prod-name-inp').value = p.name;
        document.getElementById('prod-cat-inp').value = p.category || 'NACIONAL';
        document.getElementById('prod-price-inp').value = p.price ?? 0;
        document.getElementById('prod-stock-inp').value = p.stock ?? 0;
        document.getElementById('prod-cost-inp').value = p.cost ?? 0;
        document.getElementById('prod-quick-inp').checked = Boolean(p.quick);
        document.getElementById('prod-modal').classList.remove('hidden');
      });
    });
  }

  // ==========================================================================
  // 6. MÓDULO 5: REPORTES PROFESIONALES Y ESTADÍSTICAS EJECUTIVAS
  // ==========================================================================
  function renderReportsView() {
    const t = getTotals();
    const rate = parseFloat(state.exchangeRate) || 1000;

    // 1. Calcular ganancia estimada de hoy
    let estimatedProfit = 0;
    const productSalesMap = {};

    state.dailySales.forEach(s => {
      const rev = Number(s.totalUsd) || 0;
      if (rev <= 0) return;
      const prodObj = state.products.find(p => p.name.toUpperCase() === (s.product || '').toUpperCase());
      const unitCost = prodObj && prodObj.cost > 0 ? prodObj.cost : (Number(s.price) || 0) * 0.6;
      const qty = Number(s.qty) || 1;
      estimatedProfit += Math.max(0, rev - unitCost * qty);

      const key = (s.product || 'OTRO').toUpperCase();
      if (!productSalesMap[key]) productSalesMap[key] = { name: key, qty: 0, usd: 0 };
      productSalesMap[key].qty += qty;
      productSalesMap[key].usd += rev;
    });

    // 2. Calcular totales de clientes e inventario
    let sumDeuda = 0;
    let sumFavor = 0;
    state.clients.forEach(c => {
      sumDeuda += Number(c.deuda) || 0;
      sumFavor += Number(c.aFavor) || 0;
    });

    let invVentaTotal = 0;
    const deptTotals = {
      'IMPORTADO': { count: 0, stock: 0, saleValue: 0 },
      'NACIONAL': { count: 0, stock: 0, saleValue: 0 },
      'CERVEZA NACIONAL': { count: 0, stock: 0, saleValue: 0 }
    };

    state.products.forEach(p => {
      const stk = Math.max(0, Number(p.stock) || 0);
      const val = stk * (Number(p.price) || 0);
      invVentaTotal += val;
      const cat = deptTotals[p.category] ? p.category : 'NACIONAL';
      deptTotals[cat].count++;
      deptTotals[cat].stock += stk;
      deptTotals[cat].saleValue += val;
    });

    const profitPct = t.usd > 0 ? Math.round((estimatedProfit / t.usd) * 100) : 0;

    document.getElementById('rep-kpi-ventas-usd').textContent = `$${fmt(t.usd, 2)}`;
    document.getElementById('rep-kpi-ventas-bs').textContent = `Equivalente: ${fmt(t.usd * rate, 0)} Bs`;
    document.getElementById('rep-kpi-profit-usd').textContent = `$${fmt(estimatedProfit, 2)}`;
    document.getElementById('rep-kpi-profit-pct').textContent = `Margen prom: ~${profitPct}% sobre ventas`;
    document.getElementById('rep-kpi-deuda-usd').textContent = `$${fmt(sumDeuda, 2)}`;
    document.getElementById('rep-kpi-favor-usd').textContent = `Saldo a favor clientes: $${fmt(sumFavor, 2)}`;
    document.getElementById('rep-kpi-inv-venta').textContent = `$${fmt(invVentaTotal, 2)}`;

    // 3. Gráfico: Recaudación por Método de Pago
    const payMethodsData = [
      { label: 'Punto de Venta (Bs)', usdEq: t.puntoBs / rate, rawText: `${fmt(t.puntoBs, 0)} Bs ($${fmt(t.puntoBs / rate, 2)})`, color: '' },
      { label: 'Divisas en Efectivo ($)', usdEq: t.divUsd, rawText: `$${fmt(t.divUsd, 2)}`, color: 'green' },
      { label: 'Pago Móvil (Bs)', usdEq: t.pmBs / rate, rawText: `${fmt(t.pmBs, 0)} Bs ($${fmt(t.pmBs / rate, 2)})`, color: '' },
      { label: 'Zelle ($)', usdEq: t.zelleUsd, rawText: `$${fmt(t.zelleUsd, 2)}`, color: 'green' },
      { label: 'Efectivo Bolívares (Bs)', usdEq: t.efBs / rate, rawText: `${fmt(t.efBs, 0)} Bs ($${fmt(t.efBs / rate, 2)})`, color: '' },
      { label: 'Fiado / Pendiente Hoy ($)', usdEq: t.pendUsd, rawText: `$${fmt(t.pendUsd, 2)}`, color: 'yellow' }
    ];
    const maxPayUsd = Math.max(1, ...payMethodsData.map(x => x.usdEq));

    document.getElementById('chart-payments-bars').innerHTML = payMethodsData
      .map(m => {
        const pct = Math.min(100, Math.round((m.usdEq / maxPayUsd) * 100));
        return `
        <div class="vbar-item">
          <div class="vbar-top">
            <strong>${m.label}</strong>
            <span>${m.rawText}</span>
          </div>
          <div class="vbar-track">
            <div class="vbar-fill ${m.color}" style="width: ${pct}%;"></div>
          </div>
        </div>
      `;
      })
      .join('');

    // 4. Gráfico: Top 8 Productos Más Vendidos
    const topProducts = Object.values(productSalesMap)
      .sort((a, b) => b.usd - a.usd)
      .slice(0, 8);
    const maxProdUsd = Math.max(1, ...topProducts.map(x => x.usd));

    document.getElementById('chart-top-products').innerHTML = topProducts.length
      ? topProducts
          .map(p => {
            const pct = Math.min(100, Math.round((p.usd / maxProdUsd) * 100));
            return `
          <div class="vbar-item">
            <div class="vbar-top">
              <strong>${esc(p.name)} <small style="color:var(--muted);">(${p.qty} unds)</small></strong>
              <span>$${fmt(p.usd, 2)}</span>
            </div>
            <div class="vbar-track">
              <div class="vbar-fill green" style="width: ${pct}%;"></div>
            </div>
          </div>
        `;
          })
          .join('')
      : `<p class="hint">Registra ventas en Caja Diaria para ver el ranking de productos.</p>`;

    // 5. Gráfico: Valoración de Inventario por Departamento
    const deptsArr = [
      { name: 'Productos Importados', info: deptTotals['IMPORTADO'], costInv: 11947.15 },
      { name: 'Productos Nacionales', info: deptTotals['NACIONAL'], costInv: 3781.71 },
      { name: 'Cerveza Nacional y Tobos', info: deptTotals['CERVEZA NACIONAL'], costInv: 880.75 }
    ];
    const maxDeptVal = Math.max(1, ...deptsArr.map(d => d.info.saleValue));

    document.getElementById('chart-inventory-depts').innerHTML = deptsArr
      .map(d => {
        const pct = Math.min(100, Math.round((d.info.saleValue / maxDeptVal) * 100));
        return `
        <div class="vbar-item">
          <div class="vbar-top">
            <strong>${d.name} <small style="color:var(--muted);">(${d.info.count} refs • ${fmt(d.info.stock, 0)} unds)</small></strong>
            <span>Venta: $${fmt(d.info.saleValue, 2)}</span>
          </div>
          <div class="vbar-track">
            <div class="vbar-fill" style="width: ${pct}%;"></div>
          </div>
        </div>
      `;
      })
      .join('');

    // 6. Gráfico: Top 8 Clientes con Mayor Saldo Pendiente
    const topDebtors = [...state.clients]
      .filter(c => (c.deuda || 0) > 0)
      .sort((a, b) => b.deuda - a.deuda)
      .slice(0, 8);
    const maxDebt = Math.max(1, ...topDebtors.map(c => c.deuda));

    document.getElementById('chart-top-debtors').innerHTML = topDebtors
      .map(c => {
        const pct = Math.min(100, Math.round((c.deuda / maxDebt) * 100));
        return `
        <div class="vbar-item">
          <div class="vbar-top">
            <strong>${esc(c.name)}</strong>
            <span class="text-yellow">$${fmt(c.deuda, 2)}</span>
          </div>
          <div class="vbar-track">
            <div class="vbar-fill yellow" style="width: ${pct}%;"></div>
          </div>
        </div>
      `;
      })
      .join('');
  }

  // ==========================================================================
  // 7. GENERADOR DE REPORTES IMPRIMIBLES / PDF CON MEMBRETE OFICIAL ATO'Z
  // ==========================================================================
  function openPrintableReport(type) {
    const t = getTotals();
    const rate = parseFloat(state.exchangeRate) || 1000;
    const nowStr = new Date().toLocaleString('es-VE');
    const cashierName = currentUser ? currentUser.fullName : 'David Zara';

    let reportTitle = '';
    let summaryBoxesHtml = '';
    let tableHtml = '';

    if (type === 'SALES') {
      reportTitle = 'REPORTE DE CIERRE DE CAJA Y CONSUMO DIARIO';
      summaryBoxesHtml = `
        <div class="kpi-row">
          <div class="kpi"><span>TOTAL VENTAS ($)</span><strong>$${fmt(t.usd, 2)}</strong></div>
          <div class="kpi"><span>PUNTO DE VENTA (Bs)</span><strong>${fmt(t.puntoBs, 0)} Bs</strong></div>
          <div class="kpi"><span>PAGO MÓVIL (Bs)</span><strong>${fmt(t.pmBs, 0)} Bs</strong></div>
          <div class="kpi"><span>DIVISAS ($)</span><strong>$${fmt(t.divUsd, 2)}</strong></div>
          <div class="kpi"><span>EFECTIVO BS / ZELLE</span><strong>${fmt(t.efBs, 0)} Bs / $${fmt(t.zelleUsd, 2)}</strong></div>
          <div class="kpi"><span>FIADO / PENDIENTE ($)</span><strong>$${fmt(t.pendUsd, 2)}</strong></div>
        </div>
      `;
      tableHtml = `
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th style="text-align:left;">PRODUCTO</th>
              <th>CANT</th>
              <th>PRECIO</th>
              <th>TOTAL $</th>
              <th>PAGO MÓVIL</th>
              <th>DIVISAS $</th>
              <th>EFECTIVO BS</th>
              <th>PUNTO</th>
              <th>ZELLE $</th>
              <th style="text-align:left;">CLIENTE</th>
              <th>PENDIENTE $</th>
            </tr>
          </thead>
          <tbody>
            ${state.dailySales
              .map(
                (s, i) => `
              <tr class="${s.highlight ? 'hl' : ''}">
                <td>${i + 1}</td>
                <td style="text-align:left;"><strong>${esc(s.product)}</strong></td>
                <td>${s.qty ?? ''}</td>
                <td>$${fmt(s.price, 2)}</td>
                <td><strong>$${fmt(s.totalUsd, 2)}</strong></td>
                <td>${s.pagoMovilBs > 0 ? fmt(s.pagoMovilBs, 0) : ''}</td>
                <td>${s.divisasUsd > 0 ? '$' + fmt(s.divisasUsd, 2) : ''}</td>
                <td>${s.efectivoBs > 0 ? fmt(s.efectivoBs, 0) : ''}</td>
                <td>${s.puntoBs > 0 ? fmt(s.puntoBs, 0) : ''}</td>
                <td>${s.zelleUsd > 0 ? '$' + fmt(s.zelleUsd, 2) : ''}</td>
                <td style="text-align:left;">${esc(s.client || '')}</td>
                <td>${s.pendienteUsd > 0 ? '$' + fmt(s.pendienteUsd, 2) : ''}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="4" style="text-align:left;">TOTALES GENERALES DEL TURNO</td>
              <td>$${fmt(t.usd, 2)}</td>
              <td>${fmt(t.pmBs, 0)} Bs</td>
              <td>$${fmt(t.divUsd, 2)}</td>
              <td>${fmt(t.efBs, 0)} Bs</td>
              <td>${fmt(t.puntoBs, 0)} Bs</td>
              <td>$${fmt(t.zelleUsd, 2)}</td>
              <td></td>
              <td>$${fmt(t.pendUsd, 2)}</td>
            </tr>
          </tfoot>
        </table>
      `;
    } else if (type === 'CLIENTS') {
      reportTitle = 'ESTADO DE CUENTAS POR COBRAR Y SALDOS A FAVOR';
      let sumDeuda = 0;
      let sumFavor = 0;
      const activeClients = state.clients.filter(c => (c.deuda || 0) > 0 || (c.aFavor || 0) > 0);
      activeClients.forEach(c => {
        sumDeuda += Number(c.deuda) || 0;
        sumFavor += Number(c.aFavor) || 0;
      });
      summaryBoxesHtml = `
        <div class="kpi-row">
          <div class="kpi"><span>TOTAL CUENTAS POR COBRAR ($)</span><strong>$${fmt(sumDeuda, 2)}</strong></div>
          <div class="kpi"><span>EQUIVALENTE EN BOLÍVARES</span><strong>${fmt(sumDeuda * rate, 0)} Bs</strong></div>
          <div class="kpi"><span>TOTAL SALDOS A FAVOR ($)</span><strong>$${fmt(sumFavor, 2)}</strong></div>
          <div class="kpi"><span>CLIENTES CON SALDO ACTIVO</span><strong>${activeClients.length} Clientes</strong></div>
        </div>
      `;
      tableHtml = `
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th style="text-align:left;">NOMBRE DEL CLIENTE</th>
              <th>DEUDA PENDIENTE ($)</th>
              <th>EQUIVALENTE (Bs)</th>
              <th>SALDO A FAVOR ($)</th>
              <th>ESTADO / OBSERVACIÓN</th>
            </tr>
          </thead>
          <tbody>
            ${activeClients
              .map(
                (c, i) => `
              <tr>
                <td>${i + 1}</td>
                <td style="text-align:left;"><strong>${esc(c.name)}</strong></td>
                <td>${c.deuda > 0 ? '$' + fmt(c.deuda, 2) : '—'}</td>
                <td>${c.deuda > 0 ? fmt(c.deuda * rate, 0) + ' Bs' : '—'}</td>
                <td>${c.aFavor > 0 ? '$' + fmt(c.aFavor, 2) : '—'}</td>
                <td>${c.deuda > 0 ? 'PENDIENTE POR COBRAR' : 'SALDO A FAVOR'}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      `;
    } else if (type === 'INVENTORY') {
      reportTitle = 'REPORTE DE INVENTARIO VALORIZADO Y LISTA DE PRECIOS';
      let totalUnits = 0;
      let totalSaleVal = 0;
      state.products.forEach(p => {
        const s = Math.max(0, Number(p.stock) || 0);
        totalUnits += s;
        totalSaleVal += s * (Number(p.price) || 0);
      });
      summaryBoxesHtml = `
        <div class="kpi-row">
          <div class="kpi"><span>TOTAL PRODUCTOS REGISTRADOS</span><strong>${state.products.length} Referencias</strong></div>
          <div class="kpi"><span>TOTAL UNIDADES EN STOCK</span><strong>${fmt(totalUnits, 0)} Unidades</strong></div>
          <div class="kpi"><span>COSTO INVERSIÓN INICIAL</span><strong>$16,609.61</strong></div>
          <div class="kpi"><span>VALOR TOTAL A PRECIO VENTA</span><strong>$${fmt(totalSaleVal, 2)}</strong></div>
        </div>
      `;
      const stockedProds = state.products.filter(p => (Number(p.stock) || 0) > 0 || p.quick);
      tableHtml = `
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th style="text-align:left;">PRODUCTO / REFERENCIA</th>
              <th>CATEGORÍA</th>
              <th>STOCK ACTUAL</th>
              <th>PRECIO VENTA ($)</th>
              <th>PRECIO EN BS</th>
              <th>VALOR TOTAL ($)</th>
            </tr>
          </thead>
          <tbody>
            ${stockedProds
              .map(
                (p, i) => `
              <tr>
                <td>${i + 1}</td>
                <td style="text-align:left;"><strong>${esc(p.name)}</strong></td>
                <td>${esc(p.category)}</td>
                <td><strong>${p.stock ?? 0}</strong></td>
                <td>$${fmt(p.price, 2)}</td>
                <td>${fmt((p.price || 0) * rate, 0)} Bs</td>
                <td>$${fmt((p.stock || 0) * (p.price || 0), 2)}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      `;
    }

    const win = window.open('', '_blank');
    if (!win) {
      window.print();
      return;
    }

    win.document.write(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>${reportTitle} - Bodegón & Market Ato'z</title>
        <style>
          body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #111; margin: 0; padding: 28px; font-size: 12px; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #5B141E; padding-bottom: 14px; margin-bottom: 18px; }
          .brand { display: flex; align-items: center; gap: 14px; }
          .brand img { width: 68px; height: 68px; border-radius: 50%; border: 2px solid #5B141E; object-fit: contain; }
          .brand h1 { margin: 0; font-size: 22px; color: #5B141E; letter-spacing: 0.5px; }
          .brand p { margin: 2px 0 0; font-size: 12px; color: #444; font-weight: bold; }
          .meta { text-align: right; font-size: 12px; line-height: 1.5; }
          .doc-title { background: #5B141E; color: #FFF2AA; padding: 9px 14px; font-size: 15px; font-weight: bold; border-radius: 6px; margin-bottom: 16px; text-align: center; letter-spacing: 0.5px; }
          .kpi-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; margin-bottom: 18px; }
          .kpi { border: 1.5px solid #5B141E; border-radius: 8px; padding: 10px; background: #FAF6F0; }
          .kpi span { display: block; font-size: 10px; color: #555; font-weight: bold; }
          .kpi strong { font-size: 16px; color: #5B141E; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 28px; }
          th { background: #2B070C; color: #FFF2AA; padding: 8px 6px; font-size: 11px; border: 1px solid #2B070C; text-align: center; }
          td { padding: 6px; border: 1px solid #CCC; text-align: center; font-size: 11.5px; }
          tr:nth-child(even) { background: #F9F9F9; }
          tr.hl { background: #FFF59D !important; font-weight: bold; }
          tfoot td { background: #5B141E; color: #FFF2AA; font-weight: bold; font-size: 12px; padding: 8px 6px; }
          .signatures { display: flex; justify-content: space-around; margin-top: 50px; text-align: center; }
          .sig-line { width: 220px; border-top: 1.5px solid #222; padding-top: 6px; font-weight: bold; color: #333; }
          .no-print { text-align: right; margin-bottom: 14px; }
          .btn-p { background: #5B141E; color: #FFF2AA; border: none; padding: 10px 18px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 13px; }
          @media print { .no-print { display: none; } body { padding: 10px; } }
        </style>
      </head>
      <body>
        <div class="no-print">
          <button class="btn-p" onclick="window.print()">🖨️ IMPRIMIR / GUARDAR EN PDF</button>
        </div>
        <div class="header">
          <div class="brand">
            <img src="logo.png" alt="Logo Ato'z">
            <div>
              <h1>BODEGÓN & MARKET ATO'Z</h1>
              <p>MÁS QUE UN BODEGÓN • RIF: J-500277490</p>
            </div>
          </div>
          <div class="meta">
            <div><strong>Fecha y Hora:</strong> ${nowStr}</div>
            <div><strong>Emitido por:</strong> ${esc(cashierName)}</div>
            <div><strong>Tasa de Cambio:</strong> ${fmt(rate, 2)} Bs/$</div>
          </div>
        </div>
        <div class="doc-title">${reportTitle}</div>
        ${summaryBoxesHtml}
        ${tableHtml}
        <div class="signatures">
          <div class="sig-line">Firma Cajero / Responsable (${esc(cashierName)})</div>
          <div class="sig-line">Recibido Conforme (Administración Ato'z)</div>
        </div>
      </body>
      </html>
    `);
    win.document.close();
  }

  // ==========================================================================
  // 8. CAJEROS (SOLO ADMIN dzara)
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
  // 9. EVENTOS GENERALES
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
        if (tab === 'reportes') renderReportsView();
      });
    });

    // Tasa del Día (Manual + Botones API BCV / Paralelo / Sync)
    document.getElementById('global-rate-input').addEventListener('input', e => {
      const r = parseFloat(e.target.value);
      if (r > 0) {
        state.exchangeRate = r;
        state.rateSource = 'manual';
        updateRatePillsUI();
        saveState();
        updateLiveTotal();
        renderInventoryView();
        renderReportsView();
      }
    });

    document.getElementById('btn-rate-bcv').addEventListener('click', async () => {
      if (!liveRates.bcv) await fetchLiveExchangeRates(false);
      if (liveRates.bcv) {
        applyExchangeRate(liveRates.bcv, 'bcv', true);
      } else {
        toast('Consultando tasa BCV...');
      }
    });

    document.getElementById('btn-rate-par').addEventListener('click', async () => {
      if (!liveRates.paralelo) await fetchLiveExchangeRates(false);
      if (liveRates.paralelo) {
        applyExchangeRate(liveRates.paralelo, 'paralelo', true);
      } else {
        toast('Consultando tasa Paralelo...');
      }
    });

    document.getElementById('btn-sync-rate').addEventListener('click', () => {
      fetchLiveExchangeRates(true);
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

    // Registrar Venta en 1 Clic (Y descontar del Stock)
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

      // Descontar automáticamente del stock si el producto existe en inventario
      const invItem = state.products.find(p => p.name.toUpperCase() === product);
      if (invItem && typeof invItem.stock === 'number') {
        invItem.stock = Math.max(0, round2(invItem.stock - qty));
      }

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
      renderInventoryView();
      renderReportsView();
      toast(`Registrado: ${qty}x ${product} ($${totalUsd.toFixed(2)})`);
    });

    // Buscar y exportar en Hoja Diaria
    document.getElementById('search-sales').addEventListener('input', renderSalesTable);

    document.getElementById('clear-day-btn').addEventListener('click', () => {
      if (confirm('¿Seguro que deseas limpiar la hoja para empezar un nuevo turno en cero?')) {
        state.dailySales = [];
        saveState();
        renderSalesTable();
        renderCierreView();
        renderReportsView();
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

    // Botones de Impresión de Reportes Profesionales PDF
    document.getElementById('print-daily-report-btn').addEventListener('click', () => openPrintableReport('SALES'));
    document.getElementById('print-cierre-btn').addEventListener('click', () => openPrintableReport('SALES'));
    document.getElementById('print-clients-report-btn').addEventListener('click', () => openPrintableReport('CLIENTS'));
    document.getElementById('print-inv-report-btn').addEventListener('click', () => openPrintableReport('INVENTORY'));
    document.getElementById('rep-btn-print-sales').addEventListener('click', () => openPrintableReport('SALES'));
    document.getElementById('rep-btn-print-clients').addEventListener('click', () => openPrintableReport('CLIENTS'));
    document.getElementById('rep-btn-print-inv').addEventListener('click', () => openPrintableReport('INVENTORY'));

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
      renderReportsView();
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
      renderReportsView();
      toast(`Abono de $${monto.toFixed(2)} registrado`);
    });

    // Inventario: Filtros y Modal de Crear/Editar Producto Completo
    document.getElementById('search-inv').addEventListener('input', () => { invPage = 1; renderInventoryView(); });
    document.getElementById('filter-inv-cat').addEventListener('change', () => { invPage = 1; renderInventoryView(); });

    document.getElementById('new-prod-btn').addEventListener('click', () => {
      document.getElementById('prod-edit-id').value = '';
      document.getElementById('prod-modal-title').textContent = 'Nuevo Producto';
      document.getElementById('prod-name-inp').value = '';
      document.getElementById('prod-cat-inp').value = 'CERVEZA NACIONAL';
      document.getElementById('prod-price-inp').value = '';
      document.getElementById('prod-stock-inp').value = 24;
      document.getElementById('prod-cost-inp').value = 0;
      document.getElementById('prod-quick-inp').checked = true;
      document.getElementById('prod-modal').classList.remove('hidden');
    });

    document.getElementById('close-prod-btn').addEventListener('click', () => {
      document.getElementById('prod-modal').classList.add('hidden');
    });

    document.getElementById('prod-form').addEventListener('submit', e => {
      e.preventDefault();
      const editId = document.getElementById('prod-edit-id').value;
      const name = document.getElementById('prod-name-inp').value.trim().toUpperCase();
      const category = document.getElementById('prod-cat-inp').value;
      const price = round2(parseFloat(document.getElementById('prod-price-inp').value) || 0);
      const stock = round2(parseFloat(document.getElementById('prod-stock-inp').value) || 0);
      const cost = round2(parseFloat(document.getElementById('prod-cost-inp').value) || 0);
      const quick = document.getElementById('prod-quick-inp').checked;

      if (editId) {
        const p = state.products.find(x => x.id === editId);
        if (p) {
          p.name = name;
          p.category = category;
          p.price = price;
          p.stock = stock;
          p.cost = cost;
          p.quick = quick;
        }
      } else {
        state.products.unshift({
          id: `p-${Date.now()}`,
          name,
          category,
          price,
          stock,
          cost,
          margin: 50,
          quick
        });
      }

      saveState();
      document.getElementById('prod-modal').classList.add('hidden');
      renderInventoryView();
      renderQuickButtons();
      renderDatalists();
      renderReportsView();
      toast(`Producto ${name} guardado (Stock: ${stock})`);
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
  // 10. UTILIDADES
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
    setTimeout(() => d.remove(), 2600);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
