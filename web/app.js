/**
 * ============================================================================
 * BODEGÓN & MARKET ATO'Z - SISTEMA ADMINISTRATIVO, INVENTARIO Y CONTROL DE CAJA
 * RIF: J-500277490 | "Más que un Bodegón"
 * Administrador Principal: usuario `dzara` / contraseña `dzara`
 * ============================================================================
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'ATOZ_ADMIN_SYSTEM_V1';
  const SESSION_KEY = 'ATOZ_ACTIVE_SESSION_V1';

  // Estado Global de la Aplicación
  let state = {
    exchangeRate: 1000.00,
    currentDate: new Date().toISOString().split('T')[0],
    selectedPayMethod: 'punto',
    users: [
      {
        id: 'usr-admin-1',
        fullName: 'David Zara (Admin)',
        username: 'dzara',
        password: 'dzara',
        role: 'ADMIN',
        shift: 'Jornada Completa',
        active: true
      },
      {
        id: 'usr-caj-1',
        fullName: 'Cajero Principal',
        username: 'cajero1',
        password: '1234',
        role: 'CAJERO',
        shift: 'Turno Mañana',
        active: true
      }
    ],
    products: [],
    clients: [],
    dailySales: [],
    closures: [],
    investmentSummary: {
      importados: 11947.15,
      nacionales: 3781.71,
      cerveza: 880.75,
      totalInversion: 16609.61
    },
    supabaseConfig: {
      url: 'https://woqhzmetfbfubkcdqtmh.supabase.co',
      anonKey: 'sb_publishable_vAh5dgmwqIeE7xWYz2QtzQ__CBMD-c7'
    }
  };

  let currentUser = null;
  let invCurrentPage = 1;
  const INV_PAGE_SIZE = 60;

  // ==========================================================================
  // 1. INICIALIZACIÓN Y CARGA DE DATOS
  // ==========================================================================
  function initSystem() {
    loadStateFromStorage();
    setupEventListeners();
    checkExistingSession();
  }

  function loadStateFromStorage() {
    const raw = localStorage.getItem(STORAGE_KEY);
    const initial = window.ATOZ_INITIAL_DATA || {};

    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        state = Object.assign({}, state, parsed);
        // Asegurar que dzara siempre esté presente y con acceso admin
        const hasDzara = state.users.some(u => u.username.toLowerCase() === 'dzara');
        if (!hasDzara) {
          state.users.unshift({
            id: 'usr-admin-1',
            fullName: 'David Zara (Admin)',
            username: 'dzara',
            password: 'dzara',
            role: 'ADMIN',
            shift: 'Jornada Completa',
            active: true
          });
        }
        return;
      } catch (e) {
        console.warn('Error cargando estado previo, usando datos iniciales:', e);
      }
    }

    // Cargar desde los datos extraídos de los Excel oficiales
    state.exchangeRate = initial.defaultExchangeRate || 1000.00;
    state.products = Array.isArray(initial.products) ? JSON.parse(JSON.stringify(initial.products)) : [];
    state.clients = Array.isArray(initial.clients) ? JSON.parse(JSON.stringify(initial.clients)) : [];
    state.dailySales = Array.isArray(initial.dailySales) ? JSON.parse(JSON.stringify(initial.dailySales)) : [];
    if (initial.investmentSummary) {
      state.investmentSummary = Object.assign({}, initial.investmentSummary);
    }
    saveState();
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      syncToSupabaseSilent();
    } catch (e) {
      console.error('Error guardando estado:', e);
    }
  }

  // ==========================================================================
  // 2. AUTENTICACIÓN Y CONTROL DE SESIÓN (ADMIN dzara / CAJEROS)
  // ==========================================================================
  function checkExistingSession() {
    const savedSession = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
    if (savedSession) {
      try {
        const sess = JSON.parse(savedSession);
        const found = state.users.find(u => u.username.toLowerCase() === sess.username.toLowerCase() && u.active);
        if (found) {
          currentUser = Object.assign({}, found, { currentShift: sess.currentShift || found.shift });
          enterAppShell();
          return;
        }
      } catch (e) {
        // Ignorar sesión inválida
      }
    }
    showLoginScreen();
  }

  function showLoginScreen() {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('app-shell').classList.add('hidden');
  }

  function enterAppShell() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app-shell').classList.remove('hidden');

    // Actualizar datos del usuario activo en el header
    const initials = currentUser.fullName
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
    document.getElementById('active-user-avatar').textContent = initials || 'AZ';
    document.getElementById('active-user-name').textContent = currentUser.fullName;
    document.getElementById('active-user-role').textContent =
      `${currentUser.role} • ${currentUser.currentShift || currentUser.shift}`;
    document.getElementById('cierre-cashier-badge').textContent =
      `Cajero: ${currentUser.fullName} (${currentUser.currentShift || currentUser.shift})`;

    // Mostrar/Ocultar pestañas exclusivas de Administrador
    const adminTabs = document.querySelectorAll('.admin-only-tab');
    adminTabs.forEach(tab => {
      if (currentUser.role === 'ADMIN') {
        tab.classList.remove('hidden');
      } else {
        tab.classList.add('hidden');
      }
    });

    // Inicializar inputs globales
    document.getElementById('global-rate-input').value = state.exchangeRate;
    document.getElementById('current-date-input').value = state.currentDate;
    document.getElementById('sb-url-input').value = state.supabaseConfig.url;
    document.getElementById('sb-key-input').value = state.supabaseConfig.anonKey;

    refreshAllViews();
  }

  function refreshAllViews() {
    populateDatalists();
    renderQuickProducts();
    renderDailySalesTable();
    renderCierreAudit();
    renderClosuresHistory();
    renderClientsTable();
    renderInventoryTable();
    renderCashiersTable();
    updateEntryCalculation();
  }

  // ==========================================================================
  // 3. MÓDULO 1: CONSUMO DIARIO / CAJA (POS + HOJA DE EXCEL)
  // ==========================================================================
  function populateDatalists() {
    const prodList = document.getElementById('datalist-products');
    if (prodList) {
      prodList.innerHTML = state.products
        .map(p => `<option value="${escapeHtml(p.name)}">$${Number(p.price).toFixed(2)} - ${p.category}</option>`)
        .join('');
    }

    const cliList = document.getElementById('datalist-clients');
    if (cliList) {
      cliList.innerHTML = state.clients
        .map(c => {
          let tag = 'Solvente';
          if (c.deuda > 0) tag = `Deuda: $${Number(c.deuda).toFixed(2)}`;
          else if (c.aFavor > 0) tag = `A Favor: $${Number(c.aFavor).toFixed(2)}`;
          return `<option value="${escapeHtml(c.name)}">${tag}</option>`;
        })
        .join('');
    }
  }

  function renderQuickProducts() {
    const grid = document.getElementById('quick-products-grid');
    if (!grid) return;

    const quickItems = state.products.filter(p => p.quick);
    grid.innerHTML = quickItems
      .map(
        p => `
      <button type="button" class="quick-prod-btn" data-prod-name="${escapeHtml(p.name)}" data-prod-price="${p.price}">
        <span class="qp-name">${escapeHtml(p.name)}</span>
        <span class="qp-price">$${Number(p.price).toFixed(2)}</span>
      </button>
    `
      )
      .join('');

    grid.querySelectorAll('.quick-prod-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const name = btn.getAttribute('data-prod-name');
        const price = parseFloat(btn.getAttribute('data-prod-price')) || 0;
        const prodInput = document.getElementById('entry-product');
        const qtyInput = document.getElementById('entry-qty');
        const priceInput = document.getElementById('entry-price');

        if (prodInput.value === name) {
          qtyInput.value = (parseFloat(qtyInput.value) || 0) + 1;
        } else {
          prodInput.value = name;
          qtyInput.value = 1;
          priceInput.value = price.toFixed(2);
        }
        updateEntryCalculation();
      });
    });
  }

  function updateEntryCalculation() {
    const qty = parseFloat(document.getElementById('entry-qty').value) || 0;
    const price = parseFloat(document.getElementById('entry-price').value) || 0;
    const totalUsd = round2(qty * price);

    document.getElementById('entry-total-usd').value = totalUsd.toFixed(2);

    const consumoInput = document.getElementById('entry-total-consumo');
    const targetUsd = parseFloat(consumoInput.value) > 0 ? parseFloat(consumoInput.value) : totalUsd;

    applyPaymentMethodAutoFill(state.selectedPayMethod, targetUsd);
  }

  function applyPaymentMethodAutoFill(method, amountUsd) {
    if (method === 'mixto') return; // En modo mixto el cajero escribe manualmente

    const rate = parseFloat(state.exchangeRate) || 1000;
    const amountBs = round2(amountUsd * rate);

    const pmInput = document.getElementById('entry-pm-bs');
    const divInput = document.getElementById('entry-divisas-usd');
    const efInput = document.getElementById('entry-efectivo-bs');
    const puntoInput = document.getElementById('entry-punto-bs');
    const zelleInput = document.getElementById('entry-zelle-usd');
    const pendInput = document.getElementById('entry-pendiente-usd');
    const highlightCheck = document.getElementById('entry-highlight');

    // Limpiar todos primero
    pmInput.value = '';
    divInput.value = '';
    efInput.value = '';
    puntoInput.value = '';
    zelleInput.value = '';
    pendInput.value = '';

    if (amountUsd <= 0) return;

    switch (method) {
      case 'punto':
        puntoInput.value = amountBs;
        highlightCheck.checked = false;
        break;
      case 'pagomovil':
        pmInput.value = amountBs;
        highlightCheck.checked = false;
        break;
      case 'divisas':
        divInput.value = amountUsd.toFixed(2);
        highlightCheck.checked = false;
        break;
      case 'efectivobs':
        efInput.value = amountBs;
        highlightCheck.checked = false;
        break;
      case 'zelle':
        zelleInput.value = amountUsd.toFixed(2);
        highlightCheck.checked = false;
        break;
      case 'pendiente':
        pendInput.value = amountUsd.toFixed(2);
        highlightCheck.checked = true;
        break;
    }
  }

  function renderDailySalesTable() {
    const tbody = document.getElementById('daily-sales-tbody');
    const tfoot = document.getElementById('daily-sales-tfoot');
    if (!tbody || !tfoot) return;

    const search = (document.getElementById('filter-sales-input').value || '').trim().toLowerCase();
    const filterType = document.getElementById('filter-sales-type').value || 'ALL';

    const filtered = state.dailySales.filter(s => {
      if (search) {
        const matchProd = (s.product || '').toLowerCase().includes(search);
        const matchCli = (s.client || '').toLowerCase().includes(search);
        if (!matchProd && !matchCli) return false;
      }
      if (filterType === 'YELLOW') return Boolean(s.highlight || s.pendienteUsd > 0 || s.client);
      if (filterType === 'PUNTO') return (s.puntoBs || 0) > 0;
      if (filterType === 'PM') return (s.pagoMovilBs || 0) > 0;
      if (filterType === 'DIVISAS') return (s.divisasUsd || 0) > 0;
      if (filterType === 'PENDIENTE') return (s.pendienteUsd || 0) > 0;
      return true;
    });

    // Calcular totales generales de TODA la hoja activa
    let sumTotalUsd = 0;
    let sumPmBs = 0;
    let sumDivisasUsd = 0;
    let sumEfectivoBs = 0;
    let sumPuntoBs = 0;
    let sumZelleUsd = 0;
    let sumPendienteUsd = 0;
    let sumAbonadoUsd = 0;

    state.dailySales.forEach(s => {
      sumTotalUsd += Number(s.totalUsd) || 0;
      sumPmBs += Number(s.pagoMovilBs) || 0;
      sumDivisasUsd += Number(s.divisasUsd) || 0;
      sumEfectivoBs += Number(s.efectivoBs) || 0;
      sumPuntoBs += Number(s.puntoBs) || 0;
      sumZelleUsd += Number(s.zelleUsd) || 0;
      sumPendienteUsd += Number(s.pendienteUsd) || 0;
      sumAbonadoUsd += Number(s.abonadoUsd) || 0;
    });

    // Actualizar KPIs superiores
    document.getElementById('badge-sales-count').textContent = state.dailySales.length;
    document.getElementById('pos-kpi-total-usd').textContent = `$${formatNum(sumTotalUsd, 2)}`;
    document.getElementById('pos-kpi-punto-bs').textContent = `${formatNum(sumPuntoBs, 0)} Bs`;
    document.getElementById('pos-kpi-pm-bs').textContent = `${formatNum(sumPmBs, 0)} Bs`;
    document.getElementById('pos-kpi-divisas-usd').textContent = `$${formatNum(sumDivisasUsd, 2)}`;
    document.getElementById('pos-kpi-ef-zelle').textContent = `${formatNum(sumEfectivoBs, 0)} Bs / $${formatNum(sumZelleUsd, 2)}`;
    document.getElementById('pos-kpi-pendiente').textContent = `$${formatNum(sumPendienteUsd, 2)} / $${formatNum(sumAbonadoUsd, 2)}`;

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="15" style="padding: 24px; color: var(--text-muted);">
            No hay registros que coincidan con el filtro actual. Usa los botones rápidos arriba para registrar una venta.
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = filtered
        .map((s, idx) => {
          const isYellow = Boolean(s.highlight);
          return `
          <tr class="${isYellow ? 'row-yellow-highlight' : ''}" data-row-id="${s.id}">
            <td>${idx + 1}</td>
            <td class="cell-left">${escapeHtml(s.product)}</td>
            <td>${s.qty !== '' && s.qty !== null ? s.qty : ''}</td>
            <td>$${formatNum(s.price, 2)}</td>
            <td><strong>$${formatNum(s.totalUsd, 2)}</strong></td>
            <td>${s.totalConsumoUsd ? '$' + formatNum(s.totalConsumoUsd, 2) : ''}</td>
            <td>${s.pagoMovilBs > 0 ? formatNum(s.pagoMovilBs, 0) : ''}</td>
            <td>${s.divisasUsd > 0 ? '$' + formatNum(s.divisasUsd, 2) : ''}</td>
            <td>${s.efectivoBs > 0 ? formatNum(s.efectivoBs, 0) : ''}</td>
            <td>${s.puntoBs > 0 ? formatNum(s.puntoBs, 0) : ''}</td>
            <td>${s.zelleUsd > 0 ? '$' + formatNum(s.zelleUsd, 2) : ''}</td>
            <td class="cell-left"><strong>${escapeHtml(s.client || '')}</strong></td>
            <td>${s.pendienteUsd > 0 ? '$' + formatNum(s.pendienteUsd, 2) : ''}</td>
            <td>${s.abonadoUsd > 0 ? '$' + formatNum(s.abonadoUsd, 2) : ''}</td>
            <td>
              <div class="row-action-btns">
                <button type="button" class="row-btn btn-yellow-toggle" data-id="${s.id}" title="Resaltar/Quitar Amarillo">
                  <i class="fa-solid fa-highlighter"></i>
                </button>
                <button type="button" class="row-btn btn-edit-sale" data-id="${s.id}" title="Editar fila">
                  <i class="fa-solid fa-pen"></i>
                </button>
                <button type="button" class="row-btn btn-del btn-delete-sale" data-id="${s.id}" title="Eliminar fila">
                  <i class="fa-solid fa-trash"></i>
                </button>
              </div>
            </td>
          </tr>
        `;
        })
        .join('');
    }

    tfoot.innerHTML = `
      <tr>
        <td colspan="4" class="cell-left">TOTALES DE LA HOJA (${state.dailySales.length} registros)</td>
        <td>$${formatNum(sumTotalUsd, 2)}</td>
        <td>$${formatNum(sumTotalUsd, 2)}</td>
        <td>${formatNum(sumPmBs, 0)} Bs</td>
        <td>$${formatNum(sumDivisasUsd, 2)}</td>
        <td>${formatNum(sumEfectivoBs, 0)} Bs</td>
        <td>${formatNum(sumPuntoBs, 0)} Bs</td>
        <td>$${formatNum(sumZelleUsd, 2)}</td>
        <td>—</td>
        <td>$${formatNum(sumPendienteUsd, 2)}</td>
        <td>$${formatNum(sumAbonadoUsd, 2)}</td>
        <td></td>
      </tr>
    `;

    // Eventos de fila
    tbody.querySelectorAll('.btn-yellow-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const row = state.dailySales.find(r => r.id === id);
        if (row) {
          row.highlight = !row.highlight;
          saveState();
          renderDailySalesTable();
        }
      });
    });

    tbody.querySelectorAll('.btn-edit-sale').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        loadSaleIntoFormForEdit(id);
      });
    });

    tbody.querySelectorAll('.btn-delete-sale').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        state.dailySales = state.dailySales.filter(r => r.id !== id);
        saveState();
        renderDailySalesTable();
        renderCierreAudit();
        showToast('Fila eliminada de la hoja diaria');
      });
    });
  }

  function loadSaleIntoFormForEdit(saleId) {
    const s = state.dailySales.find(r => r.id === saleId);
    if (!s) return;

    document.getElementById('sale-edit-id').value = s.id;
    document.getElementById('entry-product').value = s.product;
    document.getElementById('entry-qty').value = s.qty;
    document.getElementById('entry-price').value = s.price;
    document.getElementById('entry-total-usd').value = s.totalUsd;
    document.getElementById('entry-total-consumo').value = s.totalConsumoUsd || s.totalUsd;
    document.getElementById('entry-client').value = s.client || '';
    document.getElementById('entry-pm-bs').value = s.pagoMovilBs || '';
    document.getElementById('entry-divisas-usd').value = s.divisasUsd || '';
    document.getElementById('entry-efectivo-bs').value = s.efectivoBs || '';
    document.getElementById('entry-punto-bs').value = s.puntoBs || '';
    document.getElementById('entry-zelle-usd').value = s.zelleUsd || '';
    document.getElementById('entry-pendiente-usd').value = s.pendienteUsd || '';
    document.getElementById('entry-abonado-usd').value = s.abonadoUsd || '';
    document.getElementById('entry-highlight').checked = Boolean(s.highlight);

    // Poner en modo manual/mixto para no sobreescribir montos editados
    setPaymentPill('mixto', false);

    document.getElementById('submit-sale-btn').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> GUARDAR CAMBIOS';
    document.getElementById('cancel-edit-sale-btn').classList.remove('hidden');
    document.getElementById('entry-product').focus();
  }

  function resetSaleForm() {
    document.getElementById('sale-edit-id').value = '';
    document.getElementById('entry-product').value = '';
    document.getElementById('entry-qty').value = '1';
    document.getElementById('entry-price').value = '';
    document.getElementById('entry-total-usd').value = '0.00';
    document.getElementById('entry-total-consumo').value = '';
    document.getElementById('entry-client').value = '';
    document.getElementById('client-balance-hint').textContent = '';
    document.getElementById('entry-pm-bs').value = '';
    document.getElementById('entry-divisas-usd').value = '';
    document.getElementById('entry-efectivo-bs').value = '';
    document.getElementById('entry-punto-bs').value = '';
    document.getElementById('entry-zelle-usd').value = '';
    document.getElementById('entry-pendiente-usd').value = '';
    document.getElementById('entry-abonado-usd').value = '';
    document.getElementById('entry-highlight').checked = false;

    document.getElementById('submit-sale-btn').innerHTML = '<i class="fa-solid fa-check-double"></i> AGREGAR A LA HOJA';
    document.getElementById('cancel-edit-sale-btn').classList.add('hidden');
  }

  function setPaymentPill(method, recalculate = true) {
    state.selectedPayMethod = method;
    document.querySelectorAll('.pay-pill').forEach(p => {
      p.classList.toggle('active', p.getAttribute('data-pay') === method);
    });
    if (recalculate) {
      updateEntryCalculation();
    }
  }

  // ==========================================================================
  // 4. MÓDULO 2: CIERRE DE CAJA (ARQUEO Y CUADRE DE TURNO)
  // ==========================================================================
  function getDailySystemTotals() {
    const totals = {
      totalUsd: 0,
      puntoBs: 0,
      pmBs: 0,
      efectivoBs: 0,
      divisasUsd: 0,
      zelleUsd: 0,
      pendienteUsd: 0,
      abonadoUsd: 0,
      count: state.dailySales.length
    };
    state.dailySales.forEach(s => {
      totals.totalUsd += Number(s.totalUsd) || 0;
      totals.puntoBs += Number(s.puntoBs) || 0;
      totals.pmBs += Number(s.pagoMovilBs) || 0;
      totals.efectivoBs += Number(s.efectivoBs) || 0;
      totals.divisasUsd += Number(s.divisasUsd) || 0;
      totals.zelleUsd += Number(s.zelleUsd) || 0;
      totals.pendienteUsd += Number(s.pendienteUsd) || 0;
      totals.abonadoUsd += Number(s.abonadoUsd) || 0;
    });
    return totals;
  }

  function renderCierreAudit() {
    const t = getDailySystemTotals();
    const totalBs = t.puntoBs + t.pmBs + t.efectivoBs;
    const totalCollectedUsd = t.divisasUsd + t.zelleUsd;

    document.getElementById('cierre-sys-total-usd').textContent = `$${formatNum(t.totalUsd, 2)}`;
    document.getElementById('cierre-sys-count').textContent = `${t.count} operaciones en la hoja actual`;
    document.getElementById('cierre-sys-total-bs').textContent = `${formatNum(totalBs, 2)} Bs`;
    document.getElementById('cierre-sys-collected-usd').textContent = `$${formatNum(totalCollectedUsd, 2)}`;

    document.getElementById('sys-val-punto').textContent = `${formatNum(t.puntoBs, 2)} Bs`;
    document.getElementById('sys-val-pm').textContent = `${formatNum(t.pmBs, 2)} Bs`;
    document.getElementById('sys-val-efbs').textContent = `${formatNum(t.efectivoBs, 2)} Bs`;
    document.getElementById('sys-val-divisas').textContent = `$${formatNum(t.divisasUsd, 2)}`;
    document.getElementById('sys-val-zelle').textContent = `$${formatNum(t.zelleUsd, 2)}`;
    document.getElementById('sys-val-pendiente').textContent = `$${formatNum(t.pendienteUsd, 2)}`;
    document.getElementById('sys-val-abonado').textContent = `$${formatNum(t.abonadoUsd, 2)}`;

    // Autocompletar inputs físicos con el valor del sistema
    document.getElementById('phys-val-punto').value = round2(t.puntoBs);
    document.getElementById('phys-val-pm').value = round2(t.pmBs);
    document.getElementById('phys-val-efbs').value = round2(t.efectivoBs);
    document.getElementById('phys-val-divisas').value = round2(t.divisasUsd);
    document.getElementById('phys-val-zelle').value = round2(t.zelleUsd);

    updateAuditDifferences();
  }

  function updateAuditDifferences() {
    const t = getDailySystemTotals();
    const pairs = [
      { sys: t.puntoBs, inputId: 'phys-val-punto', diffId: 'diff-val-punto', unit: 'Bs' },
      { sys: t.pmBs, inputId: 'phys-val-pm', diffId: 'diff-val-pm', unit: 'Bs' },
      { sys: t.efectivoBs, inputId: 'phys-val-efbs', diffId: 'diff-val-efbs', unit: 'Bs' },
      { sys: t.divisasUsd, inputId: 'phys-val-divisas', diffId: 'diff-val-divisas', unit: '$' },
      { sys: t.zelleUsd, inputId: 'phys-val-zelle', diffId: 'diff-val-zelle', unit: '$' }
    ];

    pairs.forEach(p => {
      const phys = parseFloat(document.getElementById(p.inputId).value) || 0;
      const diff = round2(phys - p.sys);
      const cell = document.getElementById(p.diffId);
      if (Math.abs(diff) < 0.01) {
        cell.innerHTML = `<span class="text-green"><i class="fa-solid fa-check-circle"></i> Cuadrado</span>`;
      } else if (diff > 0) {
        cell.innerHTML = `<span class="text-gold">+${formatNum(diff, 2)} ${p.unit} (Sobrante)</span>`;
      } else {
        cell.innerHTML = `<span class="text-danger">${formatNum(diff, 2)} ${p.unit} (Faltante)</span>`;
      }
    });
  }

  function renderClosuresHistory() {
    const list = document.getElementById('closures-history-list');
    if (!list) return;

    if (!state.closures || state.closures.length === 0) {
      list.innerHTML = `
        <div class="closure-card">
          <p class="text-muted">Aún no se han guardado cierres de caja en este dispositivo. Cuando un cajero cierre su turno, aparecerá aquí con el detalle completo.</p>
        </div>
      `;
      return;
    }

    list.innerHTML = state.closures
      .map(
        c => `
      <div class="closure-card">
        <div class="closure-card-head">
          <div>
            <strong class="text-gold"><i class="fa-solid fa-receipt"></i> ${escapeHtml(c.date)} • ${escapeHtml(c.time)}</strong>
            <div style="font-size: 11.5px; color: var(--text-muted);">
              Cajero: <strong>${escapeHtml(c.cashier)}</strong> (${escapeHtml(c.shift)}) • Tasa: ${c.rate} Bs/$
            </div>
          </div>
          <span class="badge-gold">Total: $${formatNum(c.totalUsd, 2)}</span>
        </div>
        <div class="closure-grid-mini">
          <div><span>Punto:</span> <strong>${formatNum(c.puntoBs, 0)} Bs</strong></div>
          <div><span>Pago Móvil:</span> <strong>${formatNum(c.pmBs, 0)} Bs</strong></div>
          <div><span>Efectivo Bs:</span> <strong>${formatNum(c.efectivoBs, 0)} Bs</strong></div>
          <div><span>Divisas:</span> <strong>$${formatNum(c.divisasUsd, 2)}</strong></div>
          <div><span>Zelle:</span> <strong>$${formatNum(c.zelleUsd, 2)}</strong></div>
          <div><span>Pendiente:</span> <strong class="text-yellow">$${formatNum(c.pendienteUsd, 2)}</strong></div>
        </div>
        ${c.notes ? `<div style="margin-top:6px; font-size:11.5px; color:var(--gold-cream);">Nota: ${escapeHtml(c.notes)}</div>` : ''}
      </div>
    `
      )
      .join('');
  }

  // ==========================================================================
  // 5. MÓDULO 3: CLIENTES (CUENTAS POR COBRAR Y SALDOS A FAVOR)
  // ==========================================================================
  function renderClientsTable() {
    const tbody = document.getElementById('clients-tbody');
    if (!tbody) return;

    const search = (document.getElementById('filter-clients-input').value || '').trim().toLowerCase();
    const statusFilter = document.getElementById('filter-clients-status').value || 'ALL';

    let sumDeuda = 0;
    let sumFavor = 0;
    let countDeuda = 0;

    state.clients.forEach(c => {
      const d = Number(c.deuda) || 0;
      const f = Number(c.aFavor) || 0;
      sumDeuda += d;
      sumFavor += f;
      if (d > 0) countDeuda++;
    });

    document.getElementById('cli-kpi-total-deuda').textContent = `$${formatNum(sumDeuda, 2)}`;
    document.getElementById('cli-kpi-total-favor').textContent = `$${formatNum(sumFavor, 2)}`;
    document.getElementById('cli-kpi-count-deuda').textContent = countDeuda;
    document.getElementById('cli-kpi-total-count').textContent = state.clients.length;
    document.getElementById('badge-clients-count').textContent = countDeuda;

    const filtered = state.clients.filter(c => {
      if (search && !(c.name || '').toLowerCase().includes(search)) return false;
      if (statusFilter === 'DEUDA') return (c.deuda || 0) > 0;
      if (statusFilter === 'FAVOR') return (c.aFavor || 0) > 0;
      if (statusFilter === 'SOLVENTE') return (c.deuda || 0) === 0 && (c.aFavor || 0) === 0;
      return true;
    });

    tbody.innerHTML = filtered
      .map((c, idx) => {
        const deuda = Number(c.deuda) || 0;
        const favor = Number(c.aFavor) || 0;
        let badgeHtml = `<span class="text-muted">SOLVENTE</span>`;
        if (deuda > 0) {
          badgeHtml = `<span class="text-yellow"><i class="fa-solid fa-triangle-exclamation"></i> DEUDA PENDIENTE</span>`;
        } else if (favor > 0) {
          badgeHtml = `<span class="text-green"><i class="fa-solid fa-circle-check"></i> SALDO A FAVOR</span>`;
        }
        if (c.note) {
          badgeHtml += ` <small class="text-muted">(${escapeHtml(c.note)})</small>`;
        }

        return `
        <tr class="${deuda > 0 ? 'row-has-debt' : ''}">
          <td>${idx + 1}</td>
          <td class="cell-left"><strong>${escapeHtml(c.name)}</strong></td>
          <td>${deuda > 0 ? `<strong class="text-yellow">$${formatNum(deuda, 2)}</strong>` : '$0.00'}</td>
          <td>${favor > 0 ? `<strong class="text-green">$${formatNum(favor, 2)}</strong>` : '$0.00'}</td>
          <td class="cell-left">${badgeHtml}</td>
          <td>
            <div class="row-action-btns">
              <button type="button" class="btn-sm btn-gold-primary btn-abonar-cli" data-id="${c.id}" title="Registrar Abono o Prepago">
                <i class="fa-solid fa-hand-holding-dollar"></i> Abonar
              </button>
              <button type="button" class="row-btn btn-edit-cli" data-id="${c.id}" title="Editar Cliente">
                <i class="fa-solid fa-pen"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
      })
      .join('');

    tbody.querySelectorAll('.btn-abonar-cli').forEach(btn => {
      btn.addEventListener('click', () => openAbonoModal(btn.getAttribute('data-id')));
    });

    tbody.querySelectorAll('.btn-edit-cli').forEach(btn => {
      btn.addEventListener('click', () => openClientModal(btn.getAttribute('data-id')));
    });
  }

  function openClientModal(clientId = null) {
    const modal = document.getElementById('client-modal');
    if (clientId) {
      const c = state.clients.find(x => x.id === clientId);
      if (!c) return;
      document.getElementById('modal-client-id').value = c.id;
      document.getElementById('modal-client-name').value = c.name;
      document.getElementById('modal-client-deuda').value = c.deuda || 0;
      document.getElementById('modal-client-favor').value = c.aFavor || 0;
      document.getElementById('modal-client-note').value = c.note || '';
    } else {
      document.getElementById('modal-client-id').value = '';
      document.getElementById('modal-client-name').value = '';
      document.getElementById('modal-client-deuda').value = 0;
      document.getElementById('modal-client-favor').value = 0;
      document.getElementById('modal-client-note').value = '';
    }
    modal.classList.remove('hidden');
  }

  function openAbonoModal(clientId) {
    const c = state.clients.find(x => x.id === clientId);
    if (!c) return;
    document.getElementById('abono-client-id').value = c.id;
    document.getElementById('abono-client-name').textContent = c.name;
    document.getElementById('abono-client-current').textContent =
      c.deuda > 0
        ? `Deuda actual: $${formatNum(c.deuda, 2)}`
        : `Saldo a favor: $${formatNum(c.aFavor, 2)}`;
    document.getElementById('abono-amount-usd').value = c.deuda > 0 ? c.deuda : '';
    document.getElementById('abono-modal').classList.remove('hidden');
  }

  // ==========================================================================
  // 6. MÓDULO 4: INVENTARIO MAESTRO Y PRECIOS (775 PRODUCTOS)
  // ==========================================================================
  function renderInventoryTable() {
    const tbody = document.getElementById('inventory-tbody');
    const pagBar = document.getElementById('inv-pagination-bar');
    if (!tbody) return;

    const search = (document.getElementById('filter-inv-input').value || '').trim().toLowerCase();
    const catFilter = document.getElementById('filter-inv-category').value || 'ALL';
    const rate = parseFloat(state.exchangeRate) || 1000;

    document.getElementById('badge-inv-count').textContent = state.products.length;

    const filtered = state.products.filter(p => {
      if (search && !(p.name || '').toLowerCase().includes(search)) return false;
      if (catFilter === 'QUICK') return Boolean(p.quick);
      if (catFilter !== 'ALL' && p.category !== catFilter) return false;
      return true;
    });

    const totalPages = Math.max(1, Math.ceil(filtered.length / INV_PAGE_SIZE));
    if (invCurrentPage > totalPages) invCurrentPage = 1;

    const startIdx = (invCurrentPage - 1) * INV_PAGE_SIZE;
    const pageItems = filtered.slice(startIdx, startIdx + INV_PAGE_SIZE);

    tbody.innerHTML = pageItems
      .map(p => {
        const priceBs = round2((Number(p.price) || 0) * rate);
        return `
        <tr>
          <td><span class="badge-gold">${escapeHtml(p.category)}</span></td>
          <td class="cell-left"><strong>${escapeHtml(p.name)}</strong></td>
          <td>${p.stock ?? 0}</td>
          <td>$${formatNum(p.cost, 2)}</td>
          <td>${formatNum(p.margin, 0)}%</td>
          <td><strong class="text-gold">$${formatNum(p.price, 2)}</strong></td>
          <td>${formatNum(priceBs, 0)} Bs</td>
          <td>
            <button type="button" class="row-btn btn-toggle-quick" data-id="${p.id}" title="Poner/Quitar de Botones Rápidos de Caja">
              <i class="fa-${p.quick ? 'solid' : 'regular'} fa-star ${p.quick ? 'text-yellow' : ''}"></i>
            </button>
          </td>
          <td>
            <div class="row-action-btns">
              <button type="button" class="row-btn btn-edit-prod" data-id="${p.id}" title="Editar Precio/Stock">
                <i class="fa-solid fa-pen"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
      })
      .join('');

    pagBar.innerHTML = `
      <span class="text-muted">Mostrando ${pageItems.length} de ${filtered.length} productos (Página ${invCurrentPage} de ${totalPages})</span>
      <div style="display:flex; gap:6px;">
        <button type="button" class="btn-sm btn-ghost" id="inv-prev-btn" ${invCurrentPage <= 1 ? 'disabled' : ''}>Anterior</button>
        <button type="button" class="btn-sm btn-ghost" id="inv-next-btn" ${invCurrentPage >= totalPages ? 'disabled' : ''}>Siguiente</button>
      </div>
    `;

    const prevBtn = document.getElementById('inv-prev-btn');
    const nextBtn = document.getElementById('inv-next-btn');
    if (prevBtn) prevBtn.addEventListener('click', () => { if (invCurrentPage > 1) { invCurrentPage--; renderInventoryTable(); } });
    if (nextBtn) nextBtn.addEventListener('click', () => { if (invCurrentPage < totalPages) { invCurrentPage++; renderInventoryTable(); } });

    tbody.querySelectorAll('.btn-toggle-quick').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = state.products.find(x => x.id === btn.getAttribute('data-id'));
        if (p) {
          p.quick = !p.quick;
          saveState();
          renderInventoryTable();
          renderQuickProducts();
          showToast(p.quick ? `${p.name} agregado a Caja Rápida` : `${p.name} removido de Caja Rápida`);
        }
      });
    });

    tbody.querySelectorAll('.btn-edit-prod').forEach(btn => {
      btn.addEventListener('click', () => openProductModal(btn.getAttribute('data-id')));
    });
  }

  function openProductModal(prodId = null) {
    const modal = document.getElementById('product-modal');
    if (prodId) {
      const p = state.products.find(x => x.id === prodId);
      if (!p) return;
      document.getElementById('modal-prod-id').value = p.id;
      document.getElementById('modal-prod-name').value = p.name;
      document.getElementById('modal-prod-category').value = p.category || 'NACIONAL';
      document.getElementById('modal-prod-stock').value = p.stock ?? 0;
      document.getElementById('modal-prod-cost').value = p.cost ?? 0;
      document.getElementById('modal-prod-margin').value = p.margin ?? 70;
      document.getElementById('modal-prod-price').value = p.price ?? 0;
      document.getElementById('modal-prod-quick').checked = Boolean(p.quick);
    } else {
      document.getElementById('modal-prod-id').value = '';
      document.getElementById('modal-prod-name').value = '';
      document.getElementById('modal-prod-category').value = 'NACIONAL';
      document.getElementById('modal-prod-stock').value = 12;
      document.getElementById('modal-prod-cost').value = 1.00;
      document.getElementById('modal-prod-margin').value = 70;
      document.getElementById('modal-prod-price').value = 1.70;
      document.getElementById('modal-prod-quick').checked = false;
    }
    modal.classList.remove('hidden');
  }

  // ==========================================================================
  // 7. MÓDULO 5: GESTIÓN DE CAJEROS Y USUARIOS (SOLO ADMIN dzara)
  // ==========================================================================
  function renderCashiersTable() {
    const tbody = document.getElementById('cashiers-tbody');
    if (!tbody) return;

    tbody.innerHTML = state.users
      .map(
        u => `
      <tr>
        <td class="cell-left"><strong>${escapeHtml(u.fullName)}</strong></td>
        <td><span class="badge-gold">${escapeHtml(u.username)}</span></td>
        <td><code>${escapeHtml(u.password)}</code></td>
        <td>${u.role}</td>
        <td>${escapeHtml(u.shift)}</td>
        <td>${u.active ? '<span class="text-green">ACTIVO</span>' : '<span class="text-danger">INACTIVO</span>'}</td>
        <td>
          <div class="row-action-btns">
            <button type="button" class="row-btn btn-edit-usr" data-id="${u.id}" title="Editar Usuario">
              <i class="fa-solid fa-pen"></i>
            </button>
            ${
              u.username.toLowerCase() !== 'dzara'
                ? `<button type="button" class="row-btn btn-del btn-del-usr" data-id="${u.id}" title="Eliminar Usuario">
                    <i class="fa-solid fa-trash"></i>
                   </button>`
                : ''
            }
          </div>
        </td>
      </tr>
    `
      )
      .join('');

    tbody.querySelectorAll('.btn-edit-usr').forEach(btn => {
      btn.addEventListener('click', () => {
        const u = state.users.find(x => x.id === btn.getAttribute('data-id'));
        if (!u) return;
        document.getElementById('cashier-edit-id').value = u.id;
        document.getElementById('cashier-fullname').value = u.fullName;
        document.getElementById('cashier-username').value = u.username;
        document.getElementById('cashier-password').value = u.password;
        document.getElementById('cashier-role').value = u.role;
        document.getElementById('cashier-shift').value = u.shift;
      });
    });

    tbody.querySelectorAll('.btn-del-usr').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        state.users = state.users.filter(x => x.id !== id);
        saveState();
        renderCashiersTable();
        showToast('Usuario eliminado');
      });
    });
  }

  // ==========================================================================
  // 8. SINCRONIZACIÓN SUPABASE & EXPORTACIÓN A EXCEL/CSV
  // ==========================================================================
  async function syncToSupabaseSilent() {
    if (!state.supabaseConfig || !state.supabaseConfig.url || !state.supabaseConfig.anonKey) return;
    try {
      await fetch(`${state.supabaseConfig.url}/rest/v1/atoz_system_state`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: state.supabaseConfig.anonKey,
          Authorization: `Bearer ${state.supabaseConfig.anonKey}`,
          Prefer: 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          id: 'main_store',
          updated_at: new Date().toISOString(),
          payload: state
        })
      });
    } catch (e) {
      // Silencioso si la tabla aún no ha sido creada en Supabase
    }
  }

  function exportDailySalesToCsv() {
    const headers = [
      'PRODUCTO',
      'CANTIDAD',
      'PRECIO',
      'TOTAL EN $',
      'TOTAL CONSUMO $',
      'PAGO MOVIL',
      'DIVISAS',
      'EFECTIVO BS',
      'PUNTO',
      'ZELLE',
      'CLIENTE',
      'PENDIENTE',
      'ABONADO'
    ];
    const rows = state.dailySales.map(s => [
      s.product,
      s.qty,
      s.price,
      s.totalUsd,
      s.totalConsumoUsd || s.totalUsd,
      s.pagoMovilBs || '',
      s.divisasUsd || '',
      s.efectivoBs || '',
      s.puntoBs || '',
      s.zelleUsd || '',
      s.client || '',
      s.pendienteUsd || '',
      s.abonadoUsd || ''
    ]);
    downloadCsv(`Consumo_Diario_Atoz_${state.currentDate}.csv`, headers, rows);
  }

  function exportClientsToCsv() {
    const headers = ['CLIENTE', 'DEUDA ($)', 'A FAVOR ($)', 'NOTA'];
    const rows = state.clients.map(c => [c.name, c.deuda || 0, c.aFavor || 0, c.note || '']);
    downloadCsv(`Clientes_Deudas_Atoz_${state.currentDate}.csv`, headers, rows);
  }

  function exportInventoryToCsv() {
    const headers = ['CATEGORIA', 'PRODUCTO', 'STOCK', 'COSTO ($)', '% GANANCIA', 'PRECIO VENTA ($)'];
    const rows = state.products.map(p => [p.category, p.name, p.stock || 0, p.cost || 0, p.margin || 0, p.price || 0]);
    downloadCsv(`Inventario_Atoz_${state.currentDate}.csv`, headers, rows);
  }

  function downloadCsv(filename, headers, rows) {
    const csvContent =
      '\uFEFF' +
      [headers, ...rows]
        .map(row => row.map(val => `"${String(val ?? '').replace(/"/g, '""')}"`).join(';'))
        .join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Archivo ${filename} descargado`);
  }

  // ==========================================================================
  // 9. EVENT LISTENERS GENERALES
  // ==========================================================================
  function setupEventListeners() {
    // Mostrar/Ocultar contraseña en login
    document.getElementById('toggle-pwd-btn').addEventListener('click', () => {
      const pwd = document.getElementById('login-password');
      pwd.type = pwd.type === 'password' ? 'text' : 'password';
    });

    // Formulario de Login
    document.getElementById('login-form').addEventListener('submit', e => {
      e.preventDefault();
      const userVal = document.getElementById('login-username').value.trim();
      const passVal = document.getElementById('login-password').value.trim();
      const shiftVal = document.getElementById('login-shift').value;

      const found = state.users.find(
        u => u.username.toLowerCase() === userVal.toLowerCase() && u.password === passVal && u.active
      );

      if (!found) {
        document.getElementById('login-error').classList.remove('hidden');
        return;
      }

      document.getElementById('login-error').classList.add('hidden');
      currentUser = Object.assign({}, found, { currentShift: shiftVal });
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(currentUser));
      localStorage.setItem(SESSION_KEY, JSON.stringify(currentUser));
      enterAppShell();
      showToast(`Bienvenido, ${currentUser.fullName}`);
    });

    // Cerrar Sesión
    document.getElementById('logout-btn').addEventListener('click', () => {
      sessionStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(SESSION_KEY);
      currentUser = null;
      showLoginScreen();
    });

    // Navegación entre Pestañas
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.getAttribute('data-tab');
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        const panel = document.getElementById(`tab-${target}`);
        if (panel) panel.classList.add('active');
        if (target === 'cierre') renderCierreAudit();
      });
    });

    // Tasa del Día Global y Fecha
    document.getElementById('global-rate-input').addEventListener('input', e => {
      const val = parseFloat(e.target.value);
      if (val > 0) {
        state.exchangeRate = val;
        saveState();
        updateEntryCalculation();
        renderInventoryTable();
      }
    });

    document.getElementById('current-date-input').addEventListener('change', e => {
      state.currentDate = e.target.value;
      saveState();
    });

    // Mostrar/Ocultar botones rápidos
    document.getElementById('toggle-quick-grid-btn').addEventListener('click', () => {
      document.getElementById('quick-products-grid').classList.toggle('hidden');
    });

    // Autocompletar precio al elegir producto en Consumo Diario
    document.getElementById('entry-product').addEventListener('input', e => {
      const val = e.target.value.trim().toLowerCase();
      const found = state.products.find(p => p.name.toLowerCase() === val);
      if (found) {
        document.getElementById('entry-price').value = Number(found.price).toFixed(2);
        updateEntryCalculation();
      }
    });

    // Mostrar saldo del cliente al seleccionarlo en Consumo Diario
    document.getElementById('entry-client').addEventListener('input', e => {
      const val = e.target.value.trim().toLowerCase();
      const hint = document.getElementById('client-balance-hint');
      const found = state.clients.find(c => c.name.toLowerCase() === val);
      if (!found) {
        hint.textContent = '';
        return;
      }
      if (found.deuda > 0) {
        hint.innerHTML = `<span class="text-yellow"><i class="fa-solid fa-triangle-exclamation"></i> Tiene deuda previa: $${formatNum(found.deuda, 2)}</span>`;
      } else if (found.aFavor > 0) {
        hint.innerHTML = `<span class="text-green"><i class="fa-solid fa-wallet"></i> Tiene saldo a favor: $${formatNum(found.aFavor, 2)}</span>`;
      } else {
        hint.innerHTML = `<span class="text-muted">Cliente solvente ($0.00)</span>`;
      }
    });

    // Steppers de cantidad y cambios de precio
    document.getElementById('qty-minus-btn').addEventListener('click', () => {
      const q = document.getElementById('entry-qty');
      const v = Math.max(1, (parseFloat(q.value) || 1) - 1);
      q.value = v;
      updateEntryCalculation();
    });
    document.getElementById('qty-plus-btn').addEventListener('click', () => {
      const q = document.getElementById('entry-qty');
      q.value = (parseFloat(q.value) || 0) + 1;
      updateEntryCalculation();
    });
    document.getElementById('entry-qty').addEventListener('input', updateEntryCalculation);
    document.getElementById('entry-price').addEventListener('input', updateEntryCalculation);
    document.getElementById('entry-total-consumo').addEventListener('input', updateEntryCalculation);

    // Botones de Método de Pago de 1 Clic
    document.querySelectorAll('.pay-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        setPaymentPill(pill.getAttribute('data-pay'), true);
      });
    });

    // Cancelar edición de venta
    document.getElementById('cancel-edit-sale-btn').addEventListener('click', resetSaleForm);

    // Guardar Venta / Consumo en la Hoja Diaria
    document.getElementById('sale-entry-form').addEventListener('submit', e => {
      e.preventDefault();
      const editId = document.getElementById('sale-edit-id').value;
      const product = document.getElementById('entry-product').value.trim().toUpperCase();
      const qty = parseFloat(document.getElementById('entry-qty').value) || 0;
      const price = parseFloat(document.getElementById('entry-price').value) || 0;
      const totalUsd = round2(qty * price);
      const totalConsumoUsd = parseFloat(document.getElementById('entry-total-consumo').value) || totalUsd;
      const clientName = document.getElementById('entry-client').value.trim().toUpperCase();

      const pagoMovilBs = parseFloat(document.getElementById('entry-pm-bs').value) || 0;
      const divisasUsd = parseFloat(document.getElementById('entry-divisas-usd').value) || 0;
      const efectivoBs = parseFloat(document.getElementById('entry-efectivo-bs').value) || 0;
      const puntoBs = parseFloat(document.getElementById('entry-punto-bs').value) || 0;
      const zelleUsd = parseFloat(document.getElementById('entry-zelle-usd').value) || 0;
      const pendienteUsd = parseFloat(document.getElementById('entry-pendiente-usd').value) || 0;
      const abonadoUsd = parseFloat(document.getElementById('entry-abonado-usd').value) || 0;
      const highlight = document.getElementById('entry-highlight').checked;

      const record = {
        id: editId || `sale-${Date.now()}`,
        product,
        qty,
        price,
        totalUsd,
        totalConsumoUsd,
        pagoMovilBs,
        divisasUsd,
        efectivoBs,
        puntoBs,
        zelleUsd,
        client: clientName,
        pendienteUsd,
        abonadoUsd,
        highlight,
        cashier: currentUser ? currentUser.username : 'dzara',
        time: new Date().toTimeString().slice(0, 5)
      };

      if (editId) {
        const idx = state.dailySales.findIndex(r => r.id === editId);
        if (idx !== -1) state.dailySales[idx] = record;
        showToast(`Fila actualizada: ${product}`);
      } else {
        state.dailySales.push(record);
        // Descontar del inventario si existe
        const invProd = state.products.find(p => p.name.toUpperCase() === product);
        if (invProd && invProd.stock > 0) {
          invProd.stock = Math.max(0, round2(invProd.stock - qty));
        }
        // Si quedó saldo pendiente y tiene nombre de cliente, actualizar cuenta del cliente
        if (clientName && pendienteUsd > 0) {
          let cli = state.clients.find(c => c.name.toUpperCase() === clientName);
          if (!cli) {
            cli = { id: `cli-${Date.now()}`, name: clientName, deuda: 0, aFavor: 0, note: 'PENDIENTE' };
            state.clients.unshift(cli);
          }
          if (cli.aFavor >= pendienteUsd) {
            cli.aFavor = round2(cli.aFavor - pendienteUsd);
          } else {
            const remainder = round2(pendienteUsd - cli.aFavor);
            cli.aFavor = 0;
            cli.deuda = round2((cli.deuda || 0) + remainder);
          }
        }
        showToast(`Agregado: ${qty}x ${product} ($${totalUsd.toFixed(2)})`);
      }

      saveState();
      resetSaleForm();
      setPaymentPill(state.selectedPayMethod, false);
      renderDailySalesTable();
      renderClientsTable();
      renderInventoryTable();
    });

    // Filtros de la Hoja Diaria
    document.getElementById('filter-sales-input').addEventListener('input', renderDailySalesTable);
    document.getElementById('filter-sales-type').addEventListener('change', renderDailySalesTable);
    document.getElementById('export-daily-csv-btn').addEventListener('click', exportDailySalesToCsv);

    // Limpiar hoja para iniciar nuevo turno
    document.getElementById('new-day-clear-btn').addEventListener('click', () => {
      if (confirm('¿Deseas limpiar la Hoja de Consumo Diario actual para iniciar un nuevo turno en cero?')) {
        state.dailySales = [];
        saveState();
        renderDailySalesTable();
        renderCierreAudit();
        showToast('Hoja de Consumo Diario lista en cero para nuevo turno');
      }
    });

    // Inputs de arqueo en Cierre de Caja
    ['phys-val-punto', 'phys-val-pm', 'phys-val-efbs', 'phys-val-divisas', 'phys-val-zelle'].forEach(id => {
      document.getElementById(id).addEventListener('input', updateAuditDifferences);
    });

    // Guardar Cierre de Caja
    document.getElementById('close-register-form').addEventListener('submit', e => {
      e.preventDefault();
      const t = getDailySystemTotals();
      const closure = {
        id: `close-${Date.now()}`,
        date: state.currentDate,
        time: new Date().toTimeString().slice(0, 5),
        cashier: currentUser ? currentUser.fullName : 'David Zara',
        shift: currentUser ? currentUser.currentShift : 'Jornada Completa',
        rate: state.exchangeRate,
        totalUsd: t.totalUsd,
        puntoBs: parseFloat(document.getElementById('phys-val-punto').value) || 0,
        pmBs: parseFloat(document.getElementById('phys-val-pm').value) || 0,
        efectivoBs: parseFloat(document.getElementById('phys-val-efbs').value) || 0,
        divisasUsd: parseFloat(document.getElementById('phys-val-divisas').value) || 0,
        zelleUsd: parseFloat(document.getElementById('phys-val-zelle').value) || 0,
        pendienteUsd: t.pendienteUsd,
        abonadoUsd: t.abonadoUsd,
        notes: document.getElementById('cierre-notes').value.trim()
      };

      state.closures.unshift(closure);
      saveState();
      document.getElementById('cierre-notes').value = '';
      renderClosuresHistory();
      showToast('¡Cierre de caja registrado y guardado con éxito!');
    });

    document.getElementById('print-cierre-btn').addEventListener('click', () => window.print());

    // Filtros y modales de Clientes
    document.getElementById('filter-clients-input').addEventListener('input', renderClientsTable);
    document.getElementById('filter-clients-status').addEventListener('change', renderClientsTable);
    document.getElementById('open-new-client-modal-btn').addEventListener('click', () => openClientModal(null));

    document.getElementById('client-modal-form').addEventListener('submit', e => {
      e.preventDefault();
      const id = document.getElementById('modal-client-id').value;
      const name = document.getElementById('modal-client-name').value.trim().toUpperCase();
      const deuda = parseFloat(document.getElementById('modal-client-deuda').value) || 0;
      const aFavor = parseFloat(document.getElementById('modal-client-favor').value) || 0;
      const note = document.getElementById('modal-client-note').value.trim().toUpperCase();

      if (id) {
        const c = state.clients.find(x => x.id === id);
        if (c) {
          c.name = name;
          c.deuda = round2(deuda);
          c.aFavor = round2(aFavor);
          c.note = note;
        }
      } else {
        state.clients.unshift({
          id: `cli-${Date.now()}`,
          name,
          deuda: round2(deuda),
          aFavor: round2(aFavor),
          note
        });
      }

      saveState();
      populateDatalists();
      renderClientsTable();
      document.getElementById('client-modal').classList.add('hidden');
      showToast(`Cliente ${name} guardado`);
    });

    // Procesar Abono de Cliente
    document.getElementById('abono-modal-form').addEventListener('submit', e => {
      e.preventDefault();
      const cliId = document.getElementById('abono-client-id').value;
      const amountUsd = parseFloat(document.getElementById('abono-amount-usd').value) || 0;
      const method = document.getElementById('abono-method').value;
      const addToSheet = document.getElementById('abono-add-to-sheet').checked;

      const cli = state.clients.find(x => x.id === cliId);
      if (!cli || amountUsd <= 0) return;

      if (cli.deuda >= amountUsd) {
        cli.deuda = round2(cli.deuda - amountUsd);
      } else {
        const extra = round2(amountUsd - (cli.deuda || 0));
        cli.deuda = 0;
        cli.aFavor = round2((cli.aFavor || 0) + extra);
      }

      if (addToSheet) {
        const rate = parseFloat(state.exchangeRate) || 1000;
        const bs = round2(amountUsd * rate);
        state.dailySales.push({
          id: `sale-${Date.now()}`,
          product: `ABONO CUENTA (${cli.name})`,
          qty: 1,
          price: amountUsd,
          totalUsd: 0,
          totalConsumoUsd: 0,
          pagoMovilBs: method === 'pagomovil' ? bs : 0,
          divisasUsd: method === 'divisas' ? amountUsd : 0,
          efectivoBs: method === 'efectivobs' ? bs : 0,
          puntoBs: method === 'punto' ? bs : 0,
          zelleUsd: method === 'zelle' ? amountUsd : 0,
          client: cli.name,
          pendienteUsd: 0,
          abonadoUsd: amountUsd,
          highlight: false,
          cashier: currentUser ? currentUser.username : 'dzara',
          time: new Date().toTimeString().slice(0, 5)
        });
      }

      saveState();
      renderClientsTable();
      renderDailySalesTable();
      document.getElementById('abono-modal').classList.add('hidden');
      showToast(`Abono de $${amountUsd.toFixed(2)} registrado a ${cli.name}`);
    });

    // Filtros y Calculadora de Inventario
    document.getElementById('filter-inv-input').addEventListener('input', () => {
      invCurrentPage = 1;
      renderInventoryTable();
    });
    document.getElementById('filter-inv-category').addEventListener('change', () => {
      invCurrentPage = 1;
      renderInventoryTable();
    });
    document.getElementById('open-new-product-modal-btn').addEventListener('click', () => openProductModal(null));

    const recalcModalProdPrice = () => {
      const cost = parseFloat(document.getElementById('modal-prod-cost').value) || 0;
      const margin = parseFloat(document.getElementById('modal-prod-margin').value) || 0;
      document.getElementById('modal-prod-price').value = round2(cost * (1 + margin / 100)).toFixed(2);
    };
    document.getElementById('modal-prod-cost').addEventListener('input', recalcModalProdPrice);
    document.getElementById('modal-prod-margin').addEventListener('input', recalcModalProdPrice);

    document.getElementById('product-modal-form').addEventListener('submit', e => {
      e.preventDefault();
      const id = document.getElementById('modal-prod-id').value;
      const name = document.getElementById('modal-prod-name').value.trim().toUpperCase();
      const category = document.getElementById('modal-prod-category').value;
      const stock = parseFloat(document.getElementById('modal-prod-stock').value) || 0;
      const cost = parseFloat(document.getElementById('modal-prod-cost').value) || 0;
      const margin = parseFloat(document.getElementById('modal-prod-margin').value) || 0;
      const price = parseFloat(document.getElementById('modal-prod-price').value) || 0;
      const quick = document.getElementById('modal-prod-quick').checked;

      if (id) {
        const p = state.products.find(x => x.id === id);
        if (p) {
          p.name = name;
          p.category = category;
          p.stock = stock;
          p.cost = cost;
          p.margin = margin;
          p.price = price;
          p.quick = quick;
        }
      } else {
        state.products.unshift({
          id: `inv-${Date.now()}`,
          name,
          category,
          stock,
          cost,
          margin,
          price,
          quick
        });
      }

      saveState();
      populateDatalists();
      renderQuickProducts();
      renderInventoryTable();
      document.getElementById('product-modal').classList.add('hidden');
      showToast(`Producto ${name} guardado`);
    });

    // Cerrar Modales
    document.querySelectorAll('.close-modal-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-close');
        document.getElementById(target).classList.add('hidden');
      });
    });

    // Crear / Editar Cajeros
    document.getElementById('cashier-form').addEventListener('submit', e => {
      e.preventDefault();
      const editId = document.getElementById('cashier-edit-id').value;
      const fullName = document.getElementById('cashier-fullname').value.trim();
      const username = document.getElementById('cashier-username').value.trim();
      const password = document.getElementById('cashier-password').value.trim();
      const role = document.getElementById('cashier-role').value;
      const shift = document.getElementById('cashier-shift').value;

      if (editId) {
        const u = state.users.find(x => x.id === editId);
        if (u) {
          u.fullName = fullName;
          u.username = username;
          u.password = password;
          u.role = role;
          u.shift = shift;
        }
      } else {
        state.users.push({
          id: `usr-${Date.now()}`,
          fullName,
          username,
          password,
          role,
          shift,
          active: true
        });
      }

      document.getElementById('cashier-edit-id').value = '';
      document.getElementById('cashier-form').reset();
      saveState();
      renderCashiersTable();
      showToast(`Usuario ${username} guardado correctamente`);
    });

    // Configuración Supabase y Respaldos
    document.getElementById('supabase-config-form').addEventListener('submit', e => {
      e.preventDefault();
      state.supabaseConfig.url = document.getElementById('sb-url-input').value.trim();
      state.supabaseConfig.anonKey = document.getElementById('sb-key-input').value.trim();
      saveState();
      showToast('Configuración de Supabase actualizada y sincronizada');
    });

    document.getElementById('copy-sql-btn').addEventListener('click', () => {
      const sql = `CREATE TABLE IF NOT EXISTS public.atoz_system_state (
  id text PRIMARY KEY,
  updated_at timestamptz DEFAULT now(),
  payload jsonb NOT NULL
);
ALTER TABLE public.atoz_system_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON public.atoz_system_state FOR ALL USING (true) WITH CHECK (true);`;
      navigator.clipboard.writeText(sql);
      showToast('SQL copiado al portapapeles para pegar en Supabase SQL Editor');
    });

    document.getElementById('download-json-backup-btn').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Respaldo_Total_Atoz_${state.currentDate}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Respaldo JSON descargado');
    });

    document.getElementById('export-clients-csv-btn').addEventListener('click', exportClientsToCsv);
    document.getElementById('export-inventory-csv-btn').addEventListener('click', exportInventoryToCsv);

    document.getElementById('reset-factory-excel-btn').addEventListener('click', () => {
      if (confirm('¿Deseas restaurar todos los productos, clientes y la hoja diaria original de los archivos Excel?')) {
        localStorage.removeItem(STORAGE_KEY);
        loadStateFromStorage();
        refreshAllViews();
        showToast('Datos originales de los Excel restaurados');
      }
    });
  }

  // ==========================================================================
  // 10. UTILIDADES
  // ==========================================================================
  function round2(n) {
    return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  }

  function formatNum(n, decimals = 2) {
    const val = Number(n) || 0;
    return val.toLocaleString('es-VE', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function showToast(msg) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const el = document.createElement('div');
    el.className = 'toast-msg';
    el.innerHTML = `<i class="fa-solid fa-circle-check text-gold"></i> <span>${escapeHtml(msg)}</span>`;
    container.appendChild(el);
    setTimeout(() => {
      el.remove();
    }, 3200);
  }

  document.addEventListener('DOMContentLoaded', initSystem);
})();
