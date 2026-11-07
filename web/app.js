/**
 * ============================================================================
 * BODEGÓN & MARKET ATO'Z - SISTEMA ADMINISTRATIVO, INVENTARIO, CAJA Y REPORTES
 * Usuario Admin: dzara | Contraseña: dzara
 * Incluye:
 *  - Cobro de Deuda Detallada en Caja (con desglose de productos que debe)
 *  - Sincronización Multi-PC con Supabase + Respaldo Local PC (.JSON)
 *  - Soporte 100% Offline (Sin Internet) e Instalador Windows (.EXE / PWA)
 *  - Tasa Oficial BCV Automática con precisión exacta de 2 decimales
 * ============================================================================
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'ATOZ_SIMPLE_SYSTEM_V2';
  const SESSION_KEY = 'ATOZ_SIMPLE_SESSION_V2';

  // Configuración oficial de Supabase del proyecto Ato'z
  const SUPABASE_URL = 'https://woqhzmetfbfubkcdqtmh.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_vAh5dgmwqIeE7xWYz2QtzQ__CBMD-c7';

  const SUPABASE_SQL_SCRIPT = `-- ============================================================================
-- BODEGÓN & MARKET ATO'Z - SCRIPT COMPLETO DE TABLAS PARA SUPABASE
-- Instrucciones: Copia todo este código, entra a tu proyecto en Supabase ->
-- "SQL Editor" -> "New Query", pégalo y presiona "RUN".
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.atoz_cloud_state (
  id TEXT PRIMARY KEY DEFAULT 'principal',
  updated_at TIMESTAMPTZ DEFAULT now(),
  exchange_rate NUMERIC(12,2) DEFAULT 1000.00,
  payload JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS public.atoz_productos (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'NACIONAL',
  price NUMERIC(12,2) DEFAULT 0,
  cost NUMERIC(12,2) DEFAULT 0,
  margin NUMERIC(8,2) DEFAULT 50,
  stock NUMERIC(12,2) DEFAULT 0,
  quick BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.atoz_clientes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  deuda NUMERIC(12,2) DEFAULT 0,
  a_favor NUMERIC(12,2) DEFAULT 0,
  note TEXT DEFAULT '',
  items_pendientes JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.atoz_ventas (
  id TEXT PRIMARY KEY,
  fecha DATE DEFAULT CURRENT_DATE,
  hora TEXT,
  product TEXT NOT NULL,
  qty NUMERIC(12,2) DEFAULT 1,
  price NUMERIC(12,2) DEFAULT 0,
  total_usd NUMERIC(12,2) DEFAULT 0,
  total_consumo_usd NUMERIC(12,2) DEFAULT 0,
  pago_movil_bs NUMERIC(14,2) DEFAULT 0,
  divisas_usd NUMERIC(12,2) DEFAULT 0,
  efectivo_bs NUMERIC(14,2) DEFAULT 0,
  punto_bs NUMERIC(14,2) DEFAULT 0,
  zelle_usd NUMERIC(12,2) DEFAULT 0,
  client TEXT DEFAULT '',
  pendiente_usd NUMERIC(12,2) DEFAULT 0,
  abonado_usd NUMERIC(12,2) DEFAULT 0,
  highlight BOOLEAN DEFAULT false,
  cashier TEXT DEFAULT 'dzara',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.atoz_cierres (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  cashier TEXT NOT NULL,
  total_usd NUMERIC(12,2) DEFAULT 0,
  punto_bs NUMERIC(14,2) DEFAULT 0,
  pm_bs NUMERIC(14,2) DEFAULT 0,
  ef_bs NUMERIC(14,2) DEFAULT 0,
  div_usd NUMERIC(12,2) DEFAULT 0,
  zelle_usd NUMERIC(12,2) DEFAULT 0,
  nota TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.atoz_usuarios (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'CAJERO',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.atoz_cloud_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atoz_productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atoz_clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atoz_ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atoz_cierres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atoz_usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso total atoz_cloud_state" ON public.atoz_cloud_state;
CREATE POLICY "Acceso total atoz_cloud_state" ON public.atoz_cloud_state FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acceso total atoz_productos" ON public.atoz_productos;
CREATE POLICY "Acceso total atoz_productos" ON public.atoz_productos FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acceso total atoz_clientes" ON public.atoz_clientes;
CREATE POLICY "Acceso total atoz_clientes" ON public.atoz_clientes FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acceso total atoz_ventas" ON public.atoz_ventas;
CREATE POLICY "Acceso total atoz_ventas" ON public.atoz_ventas FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acceso total atoz_cierres" ON public.atoz_cierres;
CREATE POLICY "Acceso total atoz_cierres" ON public.atoz_cierres FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acceso total atoz_usuarios" ON public.atoz_usuarios;
CREATE POLICY "Acceso total atoz_usuarios" ON public.atoz_usuarios FOR ALL USING (true) WITH CHECK (true);`;

  let state = {
    updatedAt: 0,
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
  let deferredInstallPrompt = null;
  let cloudSyncTimer = null;
  // Carrito / Selección múltiple de productos para un mismo cliente en Caja
  let cartItems = [];

  // ==========================================================================
  // 1. INICIO, MODO OFFLINE (SERVICE WORKER) Y ALMACENAMIENTO LOCAL + MULTI-PC
  // ==========================================================================
  function init() {
    registerOfflineServiceWorker();
    loadState();
    loadFromIndexedDBFallback();
    ensureClientsItemizedDebt();
    bindEvents();
    checkSession();
    initSqlBox();
    pullFromSupabaseCloud(false);

    // Sincronizar automáticamente al volver a la ventana o cambiar de PC
    window.addEventListener('focus', () => {
      pullFromSupabaseCloud(false);
    });
    setInterval(() => {
      pullFromSupabaseCloud(false);
    }, 25000);
  }

  // Base de datos local IndexedDB del navegador/PC (persistencia extra en disco local)
  function saveToIndexedDB() {
    try {
      if (!window.indexedDB) return;
      const req = window.indexedDB.open('BodegonAtozLocalDB', 1);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      };
      req.onsuccess = e => {
        const db = e.target.result;
        const tx = db.transaction('kv', 'readwrite');
        tx.objectStore('kv').put(JSON.parse(JSON.stringify(state)), 'MAIN_STATE');
      };
    } catch (err) {}
  }

  function loadFromIndexedDBFallback() {
    try {
      if (!window.indexedDB) return;
      const req = window.indexedDB.open('BodegonAtozLocalDB', 1);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      };
      req.onsuccess = e => {
        const db = e.target.result;
        const tx = db.transaction('kv', 'readonly');
        const getReq = tx.objectStore('kv').get('MAIN_STATE');
        getReq.onsuccess = () => {
          const idbState = getReq.result;
          if (idbState && Number(idbState.updatedAt) > Number(state.updatedAt || 0)) {
            state = Object.assign({}, state, idbState);
            ensureClientsItemizedDebt();
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
            if (currentUser) renderAll();
          }
        };
      };
    } catch (err) {}
  }

  function safeGetStorage(k) {
    try { return localStorage.getItem(k); } catch (e) { return null; }
  }
  function safeSetStorage(k, v) {
    try { localStorage.setItem(k, v); } catch (e) {}
  }
  function safeRemoveStorage(k) {
    try { localStorage.removeItem(k); } catch (e) {}
  }

  function registerOfflineServiceWorker() {
    try {
      if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.protocol === 'http:')) {
        navigator.serviceWorker.register('sw.js').catch(() => {});
      }
      window.addEventListener('beforeinstallprompt', e => {
        e.preventDefault();
        deferredInstallPrompt = e;
      });
    } catch (e) {}
  }

  function initSqlBox() {
    const sqlArea = document.getElementById('supabase-sql-textarea');
    if (sqlArea) sqlArea.value = SUPABASE_SQL_SCRIPT;
  }

  function loadState() {
    const saved = safeGetStorage(STORAGE_KEY);
    const initial = window.ATOZ_INITIAL_DATA || {};

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        state = Object.assign({}, state, parsed);
        if (!Array.isArray(state.users) || !state.users.some(u => (u.username || '').toLowerCase() === 'dzara')) {
          state.users = [
            { id: 'u1', fullName: 'David Zara', username: 'dzara', password: 'dzara', role: 'ADMIN' },
            ...(Array.isArray(state.users) ? state.users : [])
          ];
        }
        return;
      } catch (e) {
        console.warn(e);
      }
    }

    state.updatedAt = Date.now();
    state.exchangeRate = initial.defaultExchangeRate || 1000;
    state.products = JSON.parse(JSON.stringify(initial.products || []));
    state.clients = JSON.parse(JSON.stringify(initial.clients || []));
    state.dailySales = JSON.parse(JSON.stringify(initial.dailySales || []));
    if (Array.isArray(initial.closures)) state.closures = JSON.parse(JSON.stringify(initial.closures));
    if (Array.isArray(initial.users) && initial.users.length) state.users = JSON.parse(JSON.stringify(initial.users));
    safeSetStorage(STORAGE_KEY, JSON.stringify(state));
  }

  // Garantiza que todos los clientes (incluyendo los recién agregados en la hoja de abajo) existan y tengan su detalle de productos
  function ensureClientsItemizedDebt() {
    if (!Array.isArray(state.clients)) state.clients = [];
    if (!Array.isArray(state.dailySales)) state.dailySales = [];

    // 1. Si hay ventas abajo en dailySales con nombre de cliente nuevo, asegurarse de que el cliente exista en state.clients
    state.dailySales.forEach(s => {
      const cname = (s.client || '').trim().toUpperCase();
      if (!cname) return;
      let c = state.clients.find(x => (x.name || '').trim().toUpperCase() === cname);
      if (!c) {
        c = {
          id: `c-auto-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: cname,
          deuda: 0,
          aFavor: 0,
          note: 'CLIENTE CAJA',
          itemsPendientes: []
        };
        state.clients.unshift(c);
      }
      // Si la fila de abajo está en amarillo o tiene pendienteUsd, asegurar que esté sumada en su deuda/itemsPendientes
      const pendVal = Number(s.pendienteUsd) > 0 ? Number(s.pendienteUsd) : (s.highlight && Number(s.totalUsd) > 0 ? Number(s.totalUsd) : 0);
      if (pendVal > 0) {
        if (!Array.isArray(c.itemsPendientes)) c.itemsPendientes = [];
        const itemId = `it-${s.id}`;
        if (!c.itemsPendientes.some(it => it.id === itemId)) {
          c.itemsPendientes.push({
            id: itemId,
            date: s.hora || 'Consumo Hoy',
            product: s.product || 'PRODUCTO',
            qty: Number(s.qty) || 1,
            price: Number(s.price) || pendVal,
            totalUsd: round2(pendVal)
          });
          const sumPend = round2(c.itemsPendientes.reduce((acc, it) => acc + (Number(it.totalUsd) || 0), 0));
          if (sumPend > (Number(c.deuda) || 0)) {
            c.deuda = sumPend;
          }
        }
      }
    });

    // 2. Sincronizar itemsPendientes de cada cliente con deuda
    state.clients.forEach(c => {
      if (!Array.isArray(c.itemsPendientes)) {
        c.itemsPendientes = [];
      }
      const deudaActual = round2(Number(c.deuda) || 0);
      if (deudaActual <= 0) {
        c.itemsPendientes = [];
        return;
      }

      if (c.itemsPendientes.length === 0) {
        const clientSales = state.dailySales.filter(
          s => (s.client || '').toUpperCase() === (c.name || '').toUpperCase() && (Number(s.pendienteUsd) > 0 || s.highlight)
        );
        let sumItems = 0;
        clientSales.forEach(s => {
          const sub = round2(Number(s.pendienteUsd) || Number(s.totalUsd) || 0);
          if (sub <= 0) return;
          sumItems = round2(sumItems + sub);
          c.itemsPendientes.push({
            id: `it-${s.id}`,
            date: s.hora || 'Consumo en Caja',
            product: s.product || 'CONSUMO',
            qty: Number(s.qty) || 1,
            price: Number(s.price) || sub,
            totalUsd: sub
          });
        });

        const diff = round2(deudaActual - sumItems);
        if (diff > 0.009) {
          c.itemsPendientes.unshift({
            id: `it-base-${c.id}`,
            date: 'Cuenta Acumulada',
            product: c.note && c.note !== 'PENDIENTE' && c.note !== 'CLIENTE CAJA' ? `CONSUMO PENDIENTE (${c.note})` : 'SALDO PENDIENTE DE CONSUMO EN BODEGÓN',
            qty: 1,
            price: diff,
            totalUsd: diff
          });
        }
      } else {
        const sumItems = round2(c.itemsPendientes.reduce((acc, it) => acc + (Number(it.totalUsd) || 0), 0));
        const diff = round2(deudaActual - sumItems);
        if (Math.abs(diff) > 0.02 && diff > 0) {
          c.itemsPendientes.push({
            id: `it-adj-${Date.now()}`,
            date: 'Saldo Pendiente',
            product: 'AJUSTE / SALDO ACUMULADO',
            qty: 1,
            price: diff,
            totalUsd: diff
          });
        }
      }
    });
  }

  function saveState(pushToCloud = true) {
    state.updatedAt = Date.now();
    ensureClientsItemizedDebt();
    safeSetStorage(STORAGE_KEY, JSON.stringify(state));
    saveToIndexedDB();
    if (pushToCloud) {
      if (cloudSyncTimer) clearTimeout(cloudSyncTimer);
      cloudSyncTimer = setTimeout(() => {
        pushToSupabaseCloud(false);
      }, 400);
    }
  }

  // ==========================================================================
  // 1A. SINCRONIZACIÓN EN LA NUBE CON SUPABASE (MULTI-PC)
  // ==========================================================================
  function setCloudBadge(statusText, isOnline = true) {
    const badge = document.getElementById('cloud-status-badge');
    const txt = document.getElementById('cloud-status-text');
    const sysLbl = document.getElementById('sys-cloud-status-label');
    if (txt) txt.textContent = statusText;
    if (badge) badge.classList.toggle('offline', !isOnline);
    if (sysLbl) {
      sysLbl.textContent = statusText;
      sysLbl.className = isOnline ? 'text-green' : 'text-yellow';
    }
  }

  async function pushToSupabaseCloud(manualNotify = false) {
    if (!navigator.onLine) {
      setCloudBadge('Modo Local Sin Internet (Guardado en PC)', false);
      return;
    }
    try {
      const body = {
        id: 'principal',
        updated_at: new Date().toISOString(),
        exchange_rate: Number(state.exchangeRate) || 1000,
        payload: {
          updatedAt: state.updatedAt || Date.now(),
          exchangeRate: state.exchangeRate,
          users: state.users,
          products: state.products,
          clients: state.clients,
          dailySales: state.dailySales,
          closures: state.closures
        }
      };

      const res = await fetch(`${SUPABASE_URL}/rest/v1/atoz_cloud_state?on_conflict=id`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates,return=minimal'
        },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        setCloudBadge('Nube Sincronizada (Multi-PC Activo)', true);
        if (manualNotify) toast('¡Datos guardados y sincronizados en la nube para todas las PCs!');
      } else {
        setCloudBadge('Guardado en PC (Activa SQL en pestaña 6 para Multi-PC)', false);
        if (manualNotify) {
          toast('Guardado en esta PC. Para sincronizar otra PC, copia el SQL de la pestaña 6 en Supabase.');
        }
      }
    } catch (e) {
      setCloudBadge('Modo Local / Offline Activo', false);
    }
  }

  async function pullFromSupabaseCloud(manualNotify = false) {
    if (!navigator.onLine) {
      setCloudBadge('Modo Local Sin Internet (Guardado en PC)', false);
      return;
    }
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/atoz_cloud_state?id=eq.principal&select=*`, {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        },
        cache: 'no-store'
      });

      if (!res.ok) {
        setCloudBadge('Guardado en PC (Ver Pestaña 6: BD / Windows)', false);
        return;
      }

      const rows = await res.json();
      if (Array.isArray(rows) && rows.length > 0 && rows[0].payload) {
        const cloudData = rows[0].payload;
        const cloudTime = Number(cloudData.updatedAt) || 0;
        const localTime = Number(state.updatedAt) || 0;

        // Si la nube tiene datos más recientes o se pidió descarga manual
        if (manualNotify || cloudTime > localTime) {
          state.updatedAt = cloudTime || Date.now();
          if (Array.isArray(cloudData.products) && cloudData.products.length) state.products = cloudData.products;
          if (Array.isArray(cloudData.clients) && cloudData.clients.length) state.clients = cloudData.clients;
          if (Array.isArray(cloudData.dailySales)) state.dailySales = cloudData.dailySales;
          if (Array.isArray(cloudData.closures)) state.closures = cloudData.closures;
          if (Array.isArray(cloudData.users) && cloudData.users.length) state.users = cloudData.users;
          if (Number(cloudData.exchangeRate) > 0) state.exchangeRate = Number(cloudData.exchangeRate);

          ensureClientsItemizedDebt();
          localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
          if (currentUser) renderAll();
          if (manualNotify) toast('¡Ventas, clientes e inventario actualizados desde la nube!');
        } else if (localTime > cloudTime) {
          pushToSupabaseCloud(false);
        }
        setCloudBadge('Nube Sincronizada (Multi-PC Activo)', true);
      } else {
        // Subir estado inicial a la tabla recién creada
        pushToSupabaseCloud(false);
      }
    } catch (e) {
      setCloudBadge('Modo Local / Offline Activo', false);
    }
  }

  function checkSession() {
    const raw = safeGetStorage(SESSION_KEY);
    if (raw) {
      try {
        const u = JSON.parse(raw);
        const valid = state.users.find(x => (x.username || '').toLowerCase() === (u.username || '').toLowerCase());
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
    document.getElementById('global-rate-input').value = Number(state.exchangeRate).toFixed(2);

    document.querySelectorAll('.admin-only').forEach(el => {
      el.classList.toggle('hidden', currentUser.role !== 'ADMIN');
    });

    renderAll();
    fetchBcvRateAuto(true);
    setInterval(() => fetchBcvRateAuto(false), 15 * 60 * 1000);
  }

  // ==========================================================================
  // 1B. ACTUALIZACIÓN 100% AUTOMÁTICA DE TASA OFICIAL BCV POR API (Y OFFLINE)
  // ==========================================================================
  let liveBcvRate = null;

  async function fetchBcvRateAuto(showToastOnSuccess = true) {
    const icon = document.getElementById('sync-rate-icon');
    const lbl = document.getElementById('lbl-rate-bcv');
    if (!navigator.onLine) {
      if (lbl) lbl.textContent = `${fmt(state.exchangeRate, 2)} Bs (Local)`;
      return;
    }
    if (icon) icon.classList.add('spin');

    let fetchedRate = null;

    // Intento 1: Endpoint directo oficial BCV DolarApi
    try {
      const res = await fetch('https://ve.dolarapi.com/v1/dolares/oficial', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data && Number(data.promedio) > 0) {
          fetchedRate = round2(Number(data.promedio));
        }
      }
    } catch (e) {}

    // Intento 2: Lista general DolarApi (solo oficial)
    if (!fetchedRate) {
      try {
        const res2 = await fetch('https://ve.dolarapi.com/v1/dolares', { cache: 'no-store' });
        if (res2.ok) {
          const list = await res2.json();
          const ofi = Array.isArray(list) ? list.find(d => d.fuente === 'oficial') : null;
          if (ofi && Number(ofi.promedio) > 0) {
            fetchedRate = round2(Number(ofi.promedio));
          }
        }
      } catch (e) {}
    }

    // Intento 3: API Internacional ExchangeRate (VES oficial)
    if (!fetchedRate) {
      try {
        const res3 = await fetch('https://open.er-api.com/v6/latest/USD', { cache: 'no-store' });
        if (res3.ok) {
          const fb = await res3.json();
          if (fb && fb.rates && Number(fb.rates.VES) > 0) {
            fetchedRate = round2(Number(fb.rates.VES));
          }
        }
      } catch (e) {}
    }

    if (icon) icon.classList.remove('spin');

    if (fetchedRate && fetchedRate > 0) {
      liveBcvRate = fetchedRate;
      if (lbl) lbl.textContent = `${fmt(liveBcvRate, 2)} Bs`;
      applyBcvExchangeRate(liveBcvRate, showToastOnSuccess);
    } else {
      if (lbl && !liveBcvRate) lbl.textContent = `${fmt(state.exchangeRate, 2)} Bs`;
    }
  }

  function applyBcvExchangeRate(newRate, notify = true) {
    if (!newRate || newRate <= 0) return;
    state.exchangeRate = round2(newRate);
    const inp = document.getElementById('global-rate-input');
    if (inp) inp.value = state.exchangeRate.toFixed(2);
    const bcvBtn = document.getElementById('btn-rate-bcv');
    if (bcvBtn) bcvBtn.classList.add('active');
    saveState();
    updateLiveTotal();
    renderCajaDebtSection();
    renderSalesTable();
    renderClientsView();
    renderInventoryView();
    renderReportsView();
    if (notify) {
      toast(`Tasa Oficial BCV activada: ${fmt(state.exchangeRate, 2)} Bs/$`);
    }
  }

  function renderAll() {
    ensureClientsItemizedDebt();
    const inp = document.getElementById('global-rate-input');
    if (inp) inp.value = Number(state.exchangeRate).toFixed(2);
    renderDatalists();
    renderQuickButtons();
    renderCartItems();
    updateLiveTotal();
    renderCajaDebtSection();
    renderSalesTable();
    renderCierreView();
    renderClientsView();
    renderInventoryView();
    renderReportsView();
    renderCashiersView();
  }

  // ==========================================================================
  // 2. CAJA DIARIA + SELECCIÓN MÚLTIPLE DE PRODUCTOS + COBRO DE DEUDAS
  // ==========================================================================
  function renderDatalists() {
    document.getElementById('datalist-products').innerHTML = state.products
      .map(p => `<option value="${esc(p.name)}">$${Number(p.price).toFixed(2)} (Stock: ${p.stock ?? 0})</option>`)
      .join('');

    document.getElementById('datalist-clients').innerHTML = state.clients
      .map(c => `<option value="${esc(c.name)}">${c.deuda > 0 ? 'Debe $' + fmt(c.deuda, 2) : ''}</option>`)
      .join('');
  }

  function addToCart(productName, unitPrice, addQty = 1) {
    const cleanName = (productName || '').trim().toUpperCase();
    if (!cleanName) return;
    const price = round2(parseFloat(unitPrice) || 0);
    const qty = round2(parseFloat(addQty) || 1);

    const existing = cartItems.find(it => it.product.toUpperCase() === cleanName);
    if (existing) {
      existing.qty = round2(existing.qty + qty);
      if (price > 0) existing.price = price;
    } else {
      cartItems.push({
        id: `ci-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        product: cleanName,
        qty,
        price
      });
    }

    renderQuickButtons();
    renderCartItems();
    updateLiveTotal();
  }

  function renderQuickButtons() {
    const grid = document.getElementById('quick-products-grid');
    const quicks = state.products.filter(p => p.quick);
    grid.innerHTML = quicks
      .map(p => {
        const inCart = cartItems.find(it => it.product.toUpperCase() === (p.name || '').toUpperCase());
        return `
      <button type="button" class="q-btn ${inCart ? 'in-cart' : ''}" data-name="${esc(p.name)}" data-price="${p.price}">
        <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
          <strong>${esc(p.name)}</strong>
          ${inCart ? `<span class="q-cart-badge">x${inCart.qty}</span>` : ''}
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
          <span>$${fmt(p.price, 2)}</span>
          <small style="font-size:11px; color:var(--muted);">Stock: ${p.stock ?? 0}</small>
        </div>
      </button>
    `;
      })
      .join('');

    grid.querySelectorAll('.q-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const name = btn.getAttribute('data-name');
        const price = parseFloat(btn.getAttribute('data-price')) || 0;
        addToCart(name, price, 1);
      });
    });
  }

  function renderCartItems() {
    const box = document.getElementById('cart-items-box');
    const clearBtn = document.getElementById('btn-clear-cart');
    const countLbl = document.getElementById('cart-count-label');
    const tbody = document.getElementById('cart-items-tbody');
    if (!box || !tbody) return;

    if (!cartItems.length) {
      box.classList.add('hidden');
      if (clearBtn) clearBtn.classList.add('hidden');
      return;
    }

    box.classList.remove('hidden');
    if (clearBtn) clearBtn.classList.remove('hidden');
    const totalUnits = cartItems.reduce((acc, it) => acc + (Number(it.qty) || 0), 0);
    if (countLbl) countLbl.textContent = `${cartItems.length} productos • ${totalUnits} unds`;

    const rate = parseFloat(state.exchangeRate) || 1000;
    tbody.innerHTML = cartItems
      .map(it => {
        const subUsd = round2((Number(it.qty) || 0) * (Number(it.price) || 0));
        const subBs = round2(subUsd * rate);
        return `
        <tr>
          <td style="text-align:left;"><strong>${esc(it.product)}</strong></td>
          <td>
            <div class="inline-stock-wrap">
              <button type="button" class="stock-step-btn cart-qty-minus" data-id="${it.id}">-</button>
              <input type="number" step="any" min="0.1" class="inline-stock-input cart-qty-inp" data-id="${it.id}" value="${it.qty}">
              <button type="button" class="stock-step-btn cart-qty-plus" data-id="${it.id}">+</button>
            </div>
          </td>
          <td>
            <input type="number" step="0.01" min="0" class="inline-price-input cart-price-inp" data-id="${it.id}" value="${Number(it.price).toFixed(2)}">
          </td>
          <td><strong class="text-gold">$${fmt(subUsd, 2)}</strong></td>
          <td><strong>${fmt(subBs, 2)} Bs</strong></td>
          <td>
            <button type="button" class="mini-btn cart-remove-btn" data-id="${it.id}" title="Quitar de la lista">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </td>
        </tr>
      `;
      })
      .join('');

    tbody.querySelectorAll('.cart-qty-minus').forEach(b => {
      b.addEventListener('click', () => {
        const id = b.getAttribute('data-id');
        const item = cartItems.find(x => x.id === id);
        if (!item) return;
        if (item.qty <= 1) {
          cartItems = cartItems.filter(x => x.id !== id);
        } else {
          item.qty = round2(item.qty - 1);
        }
        renderQuickButtons();
        renderCartItems();
        updateLiveTotal();
      });
    });

    tbody.querySelectorAll('.cart-qty-plus').forEach(b => {
      b.addEventListener('click', () => {
        const id = b.getAttribute('data-id');
        const item = cartItems.find(x => x.id === id);
        if (item) {
          item.qty = round2(item.qty + 1);
          renderQuickButtons();
          renderCartItems();
          updateLiveTotal();
        }
      });
    });

    tbody.querySelectorAll('.cart-qty-inp').forEach(inp => {
      inp.addEventListener('change', () => {
        const item = cartItems.find(x => x.id === inp.getAttribute('data-id'));
        const v = parseFloat(inp.value);
        if (item && v > 0) {
          item.qty = round2(v);
          renderQuickButtons();
          renderCartItems();
          updateLiveTotal();
        }
      });
    });

    tbody.querySelectorAll('.cart-price-inp').forEach(inp => {
      inp.addEventListener('change', () => {
        const item = cartItems.find(x => x.id === inp.getAttribute('data-id'));
        const v = parseFloat(inp.value);
        if (item && !isNaN(v) && v >= 0) {
          item.price = round2(v);
          renderCartItems();
          updateLiveTotal();
        }
      });
    });

    tbody.querySelectorAll('.cart-remove-btn').forEach(b => {
      b.addEventListener('click', () => {
        cartItems = cartItems.filter(x => x.id !== b.getAttribute('data-id'));
        renderQuickButtons();
        renderCartItems();
        updateLiveTotal();
      });
    });
  }

  function updateLiveTotal() {
    const manualProd = (document.getElementById('entry-product')?.value || '').trim();
    const manualQty = parseFloat(document.getElementById('entry-qty')?.value) || 0;
    const manualPrice = parseFloat(document.getElementById('entry-price')?.value) || 0;
    const manualUsd = manualProd ? round2(manualQty * manualPrice) : 0;

    const cartUsd = round2(
      cartItems.reduce((acc, it) => acc + round2((Number(it.qty) || 0) * (Number(it.price) || 0)), 0)
    );

    const totalUsd = round2(cartUsd + manualUsd);
    const rate = parseFloat(state.exchangeRate) || 1;
    const totalBs = round2(totalUsd * rate);

    document.getElementById('display-total-usd').textContent = `$${fmt(totalUsd, 2)}`;
    document.getElementById('display-total-bs').textContent = `${fmt(totalBs, 2)} Bs`;
  }

  // Obtiene el saldo a pagar y los productos detallados de un cliente (tanto de su deuda como de las compras que tenga abajo en la hoja diaria)
  function getClientPayableInfo(c) {
    if (!c) return { amountUsd: 0, items: [], isFromDailySheetOnly: false };
    const deudaUsd = round2(Number(c.deuda) || 0);
    if (deudaUsd > 0) {
      const items =
        Array.isArray(c.itemsPendientes) && c.itemsPendientes.length
          ? c.itemsPendientes
          : [
              {
                id: 'base',
                date: 'Cuenta Pendiente',
                product: 'SALDO PENDIENTE ACUMULADO',
                qty: 1,
                price: deudaUsd,
                totalUsd: deudaUsd
              }
            ];
      return { amountUsd: deudaUsd, items, isFromDailySheetOnly: false };
    }

    // Si no tiene deuda marcada como fiado pero tiene productos registrados abajo en la Hoja Diaria hoy:
    const sheetRows = (state.dailySales || []).filter(
      s => (s.client || '').trim().toUpperCase() === (c.name || '').trim().toUpperCase() && Number(s.totalUsd) > 0
    );
    if (sheetRows.length > 0) {
      const sumSheet = round2(sheetRows.reduce((acc, s) => acc + (Number(s.totalUsd) || 0), 0));
      const items = sheetRows.map(s => ({
        id: `sh-${s.id}`,
        saleId: s.id,
        date: s.hora || 'Hoy en Hoja Diaria',
        product: s.product,
        qty: s.qty ?? 1,
        price: s.price ?? s.totalUsd,
        totalUsd: round2(Number(s.totalUsd) || 0)
      }));
      return { amountUsd: sumSheet, items, isFromDailySheetOnly: true };
    }

    return { amountUsd: 0, items: [], isFromDailySheetOnly: false };
  }

  // SECCIÓN EN CAJA: COBRAR A CLIENTE CON BARRA DE BÚSQUEDA Y VER DETALLE DE LO QUE DEBE
  function renderCajaDebtSection(preselectClientId = null) {
    const sel = document.getElementById('caja-debt-client-select');
    if (!sel) return;
    ensureClientsItemizedDebt();

    const searchInput = document.getElementById('caja-debt-search');
    const query = (searchInput?.value || '').trim().toLowerCase();
    const currentVal = preselectClientId !== null ? preselectClientId : sel.value;
    const rate = parseFloat(state.exchangeRate) || 1000;

    // Incluir clientes con deuda o con compras en la hoja de abajo (y si escribe en el buscador, buscar en todos los clientes)
    const candidates = state.clients
      .map(c => ({ client: c, info: getClientPayableInfo(c) }))
      .filter(entry => {
        const matchesQuery = !query || (entry.client.name || '').toLowerCase().includes(query);
        if (!matchesQuery) return false;
        if (query) return true; // Si está buscando por nombre, mostrar cualquier cliente que coincida
        return entry.info.amountUsd > 0;
      })
      .sort((a, b) => b.info.amountUsd - a.info.amountUsd);

    let activeId = currentVal;
    if (query && candidates.length > 0) {
      // Si el usuario está escribiendo en la barra de búsqueda, seleccionar automáticamente el primer cliente encontrado
      if (!candidates.some(x => x.client.id === activeId)) {
        activeId = candidates[0].client.id;
      }
    }

    sel.innerHTML =
      `<option value="">-- Seleccionar Cliente (${candidates.length} encontrados) --</option>` +
      candidates
        .map(({ client: c, info }) => {
          const tag = info.isFromDailySheetOnly ? 'Compra en Hoja Hoy' : 'Debe';
          return `<option value="${c.id}" ${c.id === activeId ? 'selected' : ''}>${esc(c.name)} — ${tag}: $${fmt(info.amountUsd, 2)} (${fmt(round2(info.amountUsd * rate), 2)} Bs)</option>`;
        })
        .join('');

    renderSelectedCajaDebtClient(sel.value);
  }

  function renderSelectedCajaDebtClient(clientId) {
    const panel = document.getElementById('caja-debt-detail-panel');
    if (!panel) return;
    const c = state.clients.find(x => x.id === clientId);
    if (!c) {
      panel.classList.add('hidden');
      return;
    }

    const info = getClientPayableInfo(c);
    panel.classList.remove('hidden');
    const rate = parseFloat(state.exchangeRate) || 1000;
    const totalDeudaUsd = round2(info.amountUsd);
    const totalDeudaBs = round2(totalDeudaUsd * rate);

    document.getElementById('debt-cli-name').textContent = c.name;
    const badgeEl = document.getElementById('debt-cli-badge');
    if (badgeEl) {
      badgeEl.textContent = info.isFromDailySheetOnly ? 'COMPRA EN HOJA DIARIA' : totalDeudaUsd > 0 ? 'DEUDA PENDIENTE' : 'AL DÍA';
    }
    document.getElementById('debt-total-usd').textContent = `$${fmt(totalDeudaUsd, 2)}`;
    document.getElementById('debt-total-bs').textContent = `${fmt(totalDeudaBs, 2)} Bs`;

    const items = info.items.length
      ? info.items
      : [
          {
            id: 'empty',
            date: 'Hoy',
            product: 'SIN PRODUCTOS PENDIENTES',
            qty: 0,
            price: 0,
            totalUsd: 0
          }
        ];

    const tbody = document.getElementById('debt-items-tbody');
    tbody.innerHTML = items
      .map(it => {
        const subUsd = round2(Number(it.totalUsd) || 0);
        const subBs = round2(subUsd * rate);
        return `
        <tr>
          <td style="text-align:left; font-size:12px; color:var(--muted);">${esc(it.date || 'Pendiente')}</td>
          <td style="text-align:left;"><strong>${esc(it.product)}</strong></td>
          <td>${it.qty ?? 1}</td>
          <td>$${fmt(it.price, 2)}</td>
          <td><strong class="${subUsd < 0 ? 'text-green' : 'text-yellow'}">$${fmt(subUsd, 2)}</strong></td>
          <td><strong>${fmt(subBs, 2)} Bs</strong></td>
        </tr>
      `;
      })
      .join('');

    const payInput = document.getElementById('caja-debt-pay-usd');
    payInput.value = totalDeudaUsd > 0 ? totalDeudaUsd.toFixed(2) : '';
    updateCajaDebtLiveBs();
  }

  function updateCajaDebtLiveBs() {
    const payUsd = parseFloat(document.getElementById('caja-debt-pay-usd')?.value) || 0;
    const rate = parseFloat(state.exchangeRate) || 1000;
    const exactBs = round2(payUsd * rate);
    const lbl = document.getElementById('caja-debt-pay-bs-label');
    if (lbl) lbl.textContent = `${fmt(exactBs, 2)} Bs`;
  }

  function processClientDebtPayment(clientId, montoUsd, metodoPago) {
    const c = state.clients.find(x => x.id === clientId);
    const monto = round2(parseFloat(montoUsd) || 0);
    if (!c || monto <= 0) return;

    const info = getClientPayableInfo(c);
    const rate = parseFloat(state.exchangeRate) || 1000;
    const exactBs = round2(monto * rate);

    // Si el cliente tenía su compra registrada abajo en la hoja diaria pero no como deuda separada, actualizar su método de pago en las filas de abajo
    if (info.isFromDailySheetOnly && (Number(c.deuda) || 0) <= 0) {
      const sheetRows = state.dailySales.filter(
        s => (s.client || '').trim().toUpperCase() === (c.name || '').trim().toUpperCase() && Number(s.totalUsd) > 0
      );
      sheetRows.forEach(s => {
        const rowUsd = round2(Number(s.totalUsd) || 0);
        const rowBs = round2(rowUsd * rate);
        s.pagoMovilBs = metodoPago === 'pagomovil' ? rowBs : 0;
        s.divisasUsd = metodoPago === 'divisas' ? rowUsd : 0;
        s.efectivoBs = metodoPago === 'efectivobs' ? rowBs : 0;
        s.puntoBs = metodoPago === 'punto' ? rowBs : 0;
        s.zelleUsd = metodoPago === 'zelle' ? rowUsd : 0;
        s.pendienteUsd = 0;
        s.abonadoUsd = rowUsd;
        s.highlight = false;
      });
      const searchInput = document.getElementById('caja-debt-search');
      if (searchInput) searchInput.value = '';
      saveState();
      renderCajaDebtSection('');
      renderSalesTable();
      renderClientsView();
      renderCierreView();
      renderReportsView();
      toast(`¡Pago de ${c.name} por $${fmt(monto, 2)} (${fmt(exactBs, 2)} Bs) registrado en la Hoja Diaria!`);
      return;
    }

    const deudaAnterior = round2(Number(c.deuda) || 0);
    const detalleResumen = (c.itemsPendientes || [])
      .map(i => `${i.qty || 1}x ${i.product}`)
      .slice(0, 3)
      .join(', ');

    if (deudaAnterior >= monto) {
      c.deuda = round2(deudaAnterior - monto);
      if (c.deuda <= 0.009) {
        c.deuda = 0;
        c.itemsPendientes = [];
        // Quitar resaltado amarillo de las filas de hoy de este cliente si ya pagó todo
        state.dailySales.forEach(s => {
          if ((s.client || '').trim().toUpperCase() === (c.name || '').trim().toUpperCase()) {
            s.highlight = false;
            s.pendienteUsd = 0;
          }
        });
      } else {
        c.itemsPendientes.push({
          id: `ab-${Date.now()}`,
          date: new Date().toLocaleDateString('es-VE'),
          product: `ABONO EN CAJA (${metodoPago.toUpperCase()})`,
          qty: 1,
          price: -monto,
          totalUsd: -monto
        });
      }
    } else {
      const sobra = round2(monto - deudaAnterior);
      c.deuda = 0;
      c.itemsPendientes = [];
      c.aFavor = round2((Number(c.aFavor) || 0) + sobra);
    }

    state.dailySales.unshift({
      id: `s-${Date.now()}`,
      hora: new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }),
      product: `COBRO DEUDA: ${c.name}${detalleResumen ? ' (' + detalleResumen + ')' : ''}`,
      qty: 1,
      price: monto,
      totalUsd: 0,
      totalConsumoUsd: 0,
      pagoMovilBs: metodoPago === 'pagomovil' ? exactBs : 0,
      divisasUsd: metodoPago === 'divisas' ? monto : 0,
      efectivoBs: metodoPago === 'efectivobs' ? exactBs : 0,
      puntoBs: metodoPago === 'punto' ? exactBs : 0,
      zelleUsd: metodoPago === 'zelle' ? monto : 0,
      client: c.name,
      pendienteUsd: 0,
      abonadoUsd: monto,
      highlight: false
    });

    const searchInput = document.getElementById('caja-debt-search');
    if (searchInput && c.deuda <= 0) searchInput.value = '';
    saveState();
    renderCajaDebtSection(c.deuda > 0 ? c.id : '');
    renderSalesTable();
    renderClientsView();
    renderCierreView();
    renderReportsView();
    renderDatalists();

    toast(
      c.deuda > 0
        ? `Abono de $${fmt(monto, 2)} (${fmt(exactBs, 2)} Bs) registrado a ${c.name}. Resta: $${fmt(c.deuda, 2)}`
        : `¡Deuda de ${c.name} cobrada en su totalidad ($${fmt(monto, 2)} / ${fmt(exactBs, 2)} Bs)!`
    );
  }

  function getTotals() {
    const t = { usd: 0, pmBs: 0, divUsd: 0, efBs: 0, puntoBs: 0, zelleUsd: 0, pendUsd: 0, abonUsd: 0 };
    state.dailySales.forEach(s => {
      t.usd = round2(t.usd + (Number(s.totalUsd) || 0));
      t.pmBs = round2(t.pmBs + (Number(s.pagoMovilBs) || 0));
      t.divUsd = round2(t.divUsd + (Number(s.divisasUsd) || 0));
      t.efBs = round2(t.efBs + (Number(s.efectivoBs) || 0));
      t.puntoBs = round2(t.puntoBs + (Number(s.puntoBs) || 0));
      t.zelleUsd = round2(t.zelleUsd + (Number(s.zelleUsd) || 0));
      t.pendUsd = round2(t.pendUsd + (Number(s.pendienteUsd) || 0));
      t.abonUsd = round2(t.abonUsd + (Number(s.abonadoUsd) || 0));
    });
    return t;
  }

  function renderSalesTable() {
    const t = getTotals();
    document.getElementById('sum-total-usd').textContent = `$${fmt(t.usd, 2)}`;
    document.getElementById('sum-punto-bs').textContent = `${fmt(t.puntoBs, 2)} Bs`;
    document.getElementById('sum-pm-bs').textContent = `${fmt(t.pmBs, 2)} Bs`;
    document.getElementById('sum-divisas-usd').textContent = `$${fmt(t.divUsd, 2)}`;
    document.getElementById('sum-ef-zelle').textContent = `${fmt(t.efBs, 2)} Bs / $${fmt(t.zelleUsd, 2)}`;
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
        <td>${s.pagoMovilBs > 0 ? fmt(s.pagoMovilBs, 2) : ''}</td>
        <td>${s.divisasUsd > 0 ? '$' + fmt(s.divisasUsd, 2) : ''}</td>
        <td>${s.efectivoBs > 0 ? fmt(s.efectivoBs, 2) : ''}</td>
        <td>${s.puntoBs > 0 ? fmt(s.puntoBs, 2) : ''}</td>
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
        <td colspan="3" style="text-align:left;">TOTALES DEL DÍA (${state.dailySales.length} registros)</td>
        <td>$${fmt(t.usd, 2)}</td>
        <td>$${fmt(t.usd, 2)}</td>
        <td>${fmt(t.pmBs, 2)} Bs</td>
        <td>$${fmt(t.divUsd, 2)}</td>
        <td>${fmt(t.efBs, 2)} Bs</td>
        <td>${fmt(t.puntoBs, 2)} Bs</td>
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
        const saleId = b.getAttribute('data-id');
        const deletedSale = state.dailySales.find(x => x.id === saleId);
        if (deletedSale) {
          // Restaurar stock si era un producto del inventario
          const invItem = state.products.find(p => p.name.toUpperCase() === (deletedSale.product || '').toUpperCase());
          if (invItem) {
            invItem.stock = round2((Number(invItem.stock) || 0) + (Number(deletedSale.qty) || 1));
          }
          // Si era una venta fiada, descontarla también de la deuda del cliente
          if (Number(deletedSale.pendienteUsd) > 0 && deletedSale.client) {
            const c = state.clients.find(x => x.name.toUpperCase() === deletedSale.client.toUpperCase());
            if (c) {
              c.deuda = Math.max(0, round2((Number(c.deuda) || 0) - Number(deletedSale.pendienteUsd)));
              if (Array.isArray(c.itemsPendientes)) {
                c.itemsPendientes = c.itemsPendientes.filter(it => it.id !== `it-${deletedSale.id}`);
              }
            }
          }
        }
        state.dailySales = state.dailySales.filter(x => x.id !== saleId);
        saveState();
        renderAll();
        toast('Registro eliminado y stock/cuenta actualizado');
      });
    });
  }

  // ==========================================================================
  // 3. CIERRE DE CAJA
  // ==========================================================================
  function renderCierreView() {
    const t = getTotals();
    const totalBs = round2(t.puntoBs + t.pmBs + t.efBs);
    const totalDiv = round2(t.divUsd + t.zelleUsd);

    document.getElementById('cierre-total-usd').textContent = `$${fmt(t.usd, 2)}`;
    document.getElementById('cierre-total-bs').textContent = `${fmt(totalBs, 2)} Bs`;
    document.getElementById('cierre-total-divisas').textContent = `$${fmt(totalDiv, 2)}`;

    document.getElementById('cierre-line-punto').textContent = `${fmt(t.puntoBs, 2)} Bs`;
    document.getElementById('cierre-line-pm').textContent = `${fmt(t.pmBs, 2)} Bs`;
    document.getElementById('cierre-line-efbs').textContent = `${fmt(t.efBs, 2)} Bs`;
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
          Cajero: ${esc(c.cashier)} • Punto: ${fmt(c.puntoBs, 2)} Bs • Pago Móvil: ${fmt(c.pmBs, 2)} Bs • Divisas: $${fmt(c.divUsd, 2)}
        </div>
        ${c.nota ? `<div style="font-size:12.5px; margin-top:4px; color:var(--gold);">Nota: ${esc(c.nota)}</div>` : ''}
      </div>
    `
      )
      .join('');
  }

  // ==========================================================================
  // 4. CLIENTES (DEUDAS DETALLADAS Y ABONOS)
  // ==========================================================================
  function renderClientsView() {
    let sumDeuda = 0;
    let sumFavor = 0;
    const rate = parseFloat(state.exchangeRate) || 1000;

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
      .map(c => {
        const deudaUsd = round2(Number(c.deuda) || 0);
        const deudaBs = round2(deudaUsd * rate);
        const itemsText =
          deudaUsd > 0 && Array.isArray(c.itemsPendientes) && c.itemsPendientes.length
            ? c.itemsPendientes.map(it => `${it.qty || 1}x ${it.product} ($${fmt(it.totalUsd, 2)})`).join(' • ')
            : deudaUsd > 0
            ? 'Saldo pendiente en cuenta'
            : 'Al día (Sin deuda)';

        return `
      <tr>
        <td style="text-align:left;"><strong>${esc(c.name)}</strong></td>
        <td>${deudaUsd > 0 ? `<strong class="text-yellow">$${fmt(deudaUsd, 2)}</strong>` : '$0,00'}</td>
        <td>${deudaUsd > 0 ? `<strong>${fmt(deudaBs, 2)} Bs</strong>` : '0,00 Bs'}</td>
        <td style="text-align:left; max-width:340px; overflow:hidden; text-overflow:ellipsis;" title="${esc(itemsText)}">
          <span style="font-size:12.5px; color:${deudaUsd > 0 ? '#FFF' : 'var(--muted)'};">${esc(itemsText)}</span>
        </td>
        <td>${c.aFavor > 0 ? `<strong class="text-green">$${fmt(c.aFavor, 2)}</strong>` : '$0,00'}</td>
        <td>
          <div style="display:flex; gap:6px; justify-content:center;">
            <button type="button" class="btn-gold btn-abonar" data-id="${c.id}" style="padding:6px 11px; font-size:12px;">
              <i class="fa-solid fa-hand-holding-dollar"></i> Ver Detalle / Cobrar
            </button>
            ${
              deudaUsd > 0
                ? `<button type="button" class="mini-btn btn-go-caja-debt" data-id="${c.id}" title="Abrir en Caja Diaria">
                     <i class="fa-solid fa-cash-register"></i> En Caja
                   </button>`
                : ''
            }
          </div>
        </td>
      </tr>
    `;
      })
      .join('');

    tbody.querySelectorAll('.btn-abonar').forEach(btn => {
      btn.addEventListener('click', () => {
        openAbonoModal(btn.getAttribute('data-id'));
      });
    });

    tbody.querySelectorAll('.btn-go-caja-debt').forEach(btn => {
      btn.addEventListener('click', () => {
        const cid = btn.getAttribute('data-id');
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.querySelector('.nav-btn[data-tab="caja"]')?.classList.add('active');
        document.getElementById('tab-caja')?.classList.add('active');
        renderCajaDebtSection(cid);
        document.getElementById('caja-cobrar-deuda-box')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    });
  }

  function openAbonoModal(clientId) {
    const c = state.clients.find(x => x.id === clientId);
    if (!c) return;
    const rate = parseFloat(state.exchangeRate) || 1000;
    const deudaUsd = round2(Number(c.deuda) || 0);

    document.getElementById('abono-cli-id').value = c.id;
    document.getElementById('abono-modal-title').textContent = `Detalle de Cuenta y Cobro: ${c.name}`;
    document.getElementById('abono-monto').value = deudaUsd > 0 ? deudaUsd.toFixed(2) : '';
    document.getElementById('abono-monto-bs').value = `${fmt(round2(deudaUsd * rate), 2)} Bs`;

    const itemsBox = document.getElementById('abono-modal-items-box');
    if (deudaUsd > 0 && Array.isArray(c.itemsPendientes) && c.itemsPendientes.length) {
      itemsBox.innerHTML = `
        <div class="table-wrap" style="max-height:180px; overflow-y:auto; margin-bottom:8px;">
          <table class="sheet-table">
            <thead>
              <tr>
                <th style="text-align:left;">PRODUCTO / CONCEPTO QUE DEBE</th>
                <th>CANT</th>
                <th>TOTAL ($)</th>
                <th>EN BS</th>
              </tr>
            </thead>
            <tbody>
              ${c.itemsPendientes
                .map(
                  it => `
                <tr>
                  <td style="text-align:left;"><strong>${esc(it.product)}</strong> <small style="color:var(--muted);">(${esc(it.date || '')})</small></td>
                  <td>${it.qty ?? 1}</td>
                  <td class="text-yellow"><strong>$${fmt(it.totalUsd, 2)}</strong></td>
                  <td>${fmt(round2((Number(it.totalUsd) || 0) * rate), 2)} Bs</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        </div>
        <div style="display:flex; justify-content:space-between; background:rgba(255,230,0,0.12); padding:8px 12px; border-radius:8px; border:1px solid var(--yellow-row);">
          <span>Deuda Total: <strong class="text-yellow">$${fmt(deudaUsd, 2)}</strong></span>
          <span>Exacto en Bs: <strong class="text-gold">${fmt(round2(deudaUsd * rate), 2)} Bs</strong></span>
        </div>
      `;
    } else {
      itemsBox.innerHTML = `<p class="hint">Este cliente no tiene productos pendientes por pagar actualmente.</p>`;
    }

    document.getElementById('abono-modal').classList.remove('hidden');
  }

  // ==========================================================================
  // 5. INVENTARIO Y PRECIOS (EDICIÓN DIRECTA DE STOCK Y PRECIO)
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
        <td id="bs-cell-${p.id}"><strong>${fmt(round2(p.price * rate), 2)} Bs</strong></td>
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

    tbody.querySelectorAll('.inline-price-input').forEach(inp => {
      inp.addEventListener('change', () => {
        const id = inp.getAttribute('data-id');
        const p = state.products.find(x => x.id === id);
        const val = parseFloat(inp.value);
        if (p && !isNaN(val) && val >= 0) {
          p.price = round2(val);
          inp.value = p.price.toFixed(2);
          const bsCell = document.getElementById(`bs-cell-${p.id}`);
          const currentRate = parseFloat(state.exchangeRate) || 1;
          if (bsCell) bsCell.innerHTML = `<strong>${fmt(round2(p.price * currentRate), 2)} Bs</strong>`;
          saveState();
          renderQuickButtons();
          renderDatalists();
          renderReportsView();
          toast(`Precio de ${p.name}: $${fmt(p.price, 2)}`);
        }
      });
    });

    tbody.querySelectorAll('.inline-stock-input').forEach(inp => {
      inp.addEventListener('change', () => {
        const id = inp.getAttribute('data-id');
        const p = state.products.find(x => x.id === id);
        const val = parseFloat(inp.value);
        if (p && !isNaN(val)) {
          p.stock = round2(val);
          saveState();
          renderQuickButtons();
          renderDatalists();
          renderReportsView();
          toast(`Stock de ${p.name} actualizado a ${p.stock}`);
        }
      });
    });

    tbody.querySelectorAll('.btn-stk-minus').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const p = state.products.find(x => x.id === id);
        if (p) {
          p.stock = Math.max(0, round2((Number(p.stock) || 0) - 1));
          saveState();
          renderInventoryView();
          renderQuickButtons();
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
          renderQuickButtons();
          renderDatalists();
          renderReportsView();
          toast(`Stock ${p.name}: ${p.stock}`);
        }
      });
    });

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
    document.getElementById('rep-kpi-ventas-bs').textContent = `Equivalente: ${fmt(round2(t.usd * rate), 2)} Bs`;
    document.getElementById('rep-kpi-profit-usd').textContent = `$${fmt(estimatedProfit, 2)}`;
    document.getElementById('rep-kpi-profit-pct').textContent = `Margen prom: ~${profitPct}% sobre ventas`;
    document.getElementById('rep-kpi-deuda-usd').textContent = `$${fmt(sumDeuda, 2)}`;
    document.getElementById('rep-kpi-favor-usd').textContent = `Saldo a favor clientes: $${fmt(sumFavor, 2)}`;
    document.getElementById('rep-kpi-inv-venta').textContent = `$${fmt(invVentaTotal, 2)}`;

    const payMethodsData = [
      { label: 'Punto de Venta (Bs)', usdEq: t.puntoBs / rate, rawText: `${fmt(t.puntoBs, 2)} Bs ($${fmt(t.puntoBs / rate, 2)})`, color: '' },
      { label: 'Divisas en Efectivo ($)', usdEq: t.divUsd, rawText: `$${fmt(t.divUsd, 2)}`, color: 'green' },
      { label: 'Pago Móvil (Bs)', usdEq: t.pmBs / rate, rawText: `${fmt(t.pmBs, 2)} Bs ($${fmt(t.pmBs / rate, 2)})`, color: '' },
      { label: 'Zelle ($)', usdEq: t.zelleUsd, rawText: `$${fmt(t.zelleUsd, 2)}`, color: 'green' },
      { label: 'Efectivo Bolívares (Bs)', usdEq: t.efBs / rate, rawText: `${fmt(t.efBs, 2)} Bs ($${fmt(t.efBs / rate, 2)})`, color: '' },
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

    const deptsArr = [
      { name: 'Productos Importados', info: deptTotals['IMPORTADO'] },
      { name: 'Productos Nacionales', info: deptTotals['NACIONAL'] },
      { name: 'Cerveza Nacional y Tobos', info: deptTotals['CERVEZA NACIONAL'] }
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
            <span class="text-yellow">$${fmt(c.deuda, 2)} (${fmt(round2(c.deuda * rate), 2)} Bs)</span>
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
  function openPrintableReport(type, optionalClient = null) {
    const t = getTotals();
    const rate = parseFloat(state.exchangeRate) || 1000;
    const nowStr = new Date().toLocaleString('es-VE');
    const cashierName = currentUser ? currentUser.fullName : 'David Zara';

    let reportTitle = '';
    let summaryBoxesHtml = '';
    let tableHtml = '';

    if (type === 'CLIENT_TICKET' && optionalClient) {
      const c = optionalClient;
      const deudaUsd = round2(Number(c.deuda) || 0);
      const deudaBs = round2(deudaUsd * rate);
      reportTitle = `ESTADO DE CUENTA DETALLADO — CLIENTE: ${c.name}`;
      summaryBoxesHtml = `
        <div class="kpi-row">
          <div class="kpi"><span>CLIENTE</span><strong>${esc(c.name)}</strong></div>
          <div class="kpi"><span>DEUDA TOTAL EN DÓLARES</span><strong>$${fmt(deudaUsd, 2)}</strong></div>
          <div class="kpi"><span>TASA BCV APLICADA</span><strong>${fmt(rate, 2)} Bs/$</strong></div>
          <div class="kpi"><span>TOTAL EXACTO EN BOLÍVARES</span><strong>${fmt(deudaBs, 2)} Bs</strong></div>
        </div>
      `;
      const items = Array.isArray(c.itemsPendientes) && c.itemsPendientes.length
        ? c.itemsPendientes
        : [{ date: 'Cuenta Acumulada', product: 'SALDO PENDIENTE EN BODEGÓN', qty: 1, price: deudaUsd, totalUsd: deudaUsd }];
      tableHtml = `
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th style="text-align:left;">FECHA / ORIGEN</th>
              <th style="text-align:left;">PRODUCTO / CONCEPTO QUE DEBE</th>
              <th>CANT</th>
              <th>PRECIO UNIT ($)</th>
              <th>SUBTOTAL ($)</th>
              <th>SUBTOTAL EXACTO (Bs)</th>
            </tr>
          </thead>
          <tbody>
            ${items
              .map(
                (it, i) => `
              <tr>
                <td>${i + 1}</td>
                <td style="text-align:left;">${esc(it.date || '')}</td>
                <td style="text-align:left;"><strong>${esc(it.product)}</strong></td>
                <td>${it.qty ?? 1}</td>
                <td>$${fmt(it.price, 2)}</td>
                <td><strong>$${fmt(it.totalUsd, 2)}</strong></td>
                <td><strong>${fmt(round2((Number(it.totalUsd) || 0) * rate), 2)} Bs</strong></td>
              </tr>
            `
              )
              .join('')}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="5" style="text-align:left;">TOTAL PENDIENTE A PAGAR POR ${esc(c.name)}</td>
              <td>$${fmt(deudaUsd, 2)}</td>
              <td>${fmt(deudaBs, 2)} Bs</td>
            </tr>
          </tfoot>
        </table>
      `;
    } else if (type === 'SALES') {
      reportTitle = 'REPORTE DE CIERRE DE CAJA Y CONSUMO DIARIO';
      summaryBoxesHtml = `
        <div class="kpi-row">
          <div class="kpi"><span>TOTAL VENTAS ($)</span><strong>$${fmt(t.usd, 2)}</strong></div>
          <div class="kpi"><span>PUNTO DE VENTA (Bs)</span><strong>${fmt(t.puntoBs, 2)} Bs</strong></div>
          <div class="kpi"><span>PAGO MÓVIL (Bs)</span><strong>${fmt(t.pmBs, 2)} Bs</strong></div>
          <div class="kpi"><span>DIVISAS ($)</span><strong>$${fmt(t.divUsd, 2)}</strong></div>
          <div class="kpi"><span>EFECTIVO BS / ZELLE</span><strong>${fmt(t.efBs, 2)} Bs / $${fmt(t.zelleUsd, 2)}</strong></div>
          <div class="kpi"><span>FIADO / ABONOS HOY</span><strong>$${fmt(t.pendUsd, 2)} / $${fmt(t.abonUsd, 2)}</strong></div>
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
              <th>ABONADO $</th>
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
                <td>${s.pagoMovilBs > 0 ? fmt(s.pagoMovilBs, 2) : ''}</td>
                <td>${s.divisasUsd > 0 ? '$' + fmt(s.divisasUsd, 2) : ''}</td>
                <td>${s.efectivoBs > 0 ? fmt(s.efectivoBs, 2) : ''}</td>
                <td>${s.puntoBs > 0 ? fmt(s.puntoBs, 2) : ''}</td>
                <td>${s.zelleUsd > 0 ? '$' + fmt(s.zelleUsd, 2) : ''}</td>
                <td style="text-align:left;">${esc(s.client || '')}</td>
                <td>${s.pendienteUsd > 0 ? '$' + fmt(s.pendienteUsd, 2) : ''}</td>
                <td>${s.abonadoUsd > 0 ? '$' + fmt(s.abonadoUsd, 2) : ''}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="4" style="text-align:left;">TOTALES GENERALES DEL TURNO</td>
              <td>$${fmt(t.usd, 2)}</td>
              <td>${fmt(t.pmBs, 2)} Bs</td>
              <td>$${fmt(t.divUsd, 2)}</td>
              <td>${fmt(t.efBs, 2)} Bs</td>
              <td>${fmt(t.puntoBs, 2)} Bs</td>
              <td>$${fmt(t.zelleUsd, 2)}</td>
              <td></td>
              <td>$${fmt(t.pendUsd, 2)}</td>
              <td>$${fmt(t.abonUsd, 2)}</td>
            </tr>
          </tfoot>
        </table>
      `;
    } else if (type === 'CLIENTS') {
      reportTitle = 'ESTADO DE CUENTAS POR COBRAR (CON DETALLE) Y SALDOS A FAVOR';
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
          <div class="kpi"><span>EQUIVALENTE EXACTO EN BS</span><strong>${fmt(round2(sumDeuda * rate), 2)} Bs</strong></div>
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
              <th style="text-align:left;">DETALLE DE PRODUCTOS / CONSUMO QUE DEBE</th>
              <th>SALDO A FAVOR ($)</th>
            </tr>
          </thead>
          <tbody>
            ${activeClients
              .map((c, i) => {
                const det =
                  c.deuda > 0 && Array.isArray(c.itemsPendientes) && c.itemsPendientes.length
                    ? c.itemsPendientes.map(it => `${it.qty || 1}x ${it.product} ($${fmt(it.totalUsd, 2)})`).join(', ')
                    : c.deuda > 0
                    ? 'Saldo pendiente acumulado'
                    : 'Saldo a favor';
                return `
              <tr>
                <td>${i + 1}</td>
                <td style="text-align:left;"><strong>${esc(c.name)}</strong></td>
                <td>${c.deuda > 0 ? '$' + fmt(c.deuda, 2) : '—'}</td>
                <td>${c.deuda > 0 ? fmt(round2(c.deuda * rate), 2) + ' Bs' : '—'}</td>
                <td style="text-align:left;">${esc(det)}</td>
                <td>${c.aFavor > 0 ? '$' + fmt(c.aFavor, 2) : '—'}</td>
              </tr>
            `;
              })
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
          <div class="kpi"><span>COSTO INVERSIÓN INICIAL</span><strong>$16.609,61</strong></div>
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
                <td>${fmt(round2((p.price || 0) * rate), 2)} Bs</td>
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
            <div><strong>Tasa Oficial BCV:</strong> ${fmt(rate, 2)} Bs/$</div>
          </div>
        </div>
        <div class="doc-title">${reportTitle}</div>
        ${summaryBoxesHtml}
        ${tableHtml}
        <div class="signatures">
          <div class="sig-line">Firma Cajero / Responsable (${esc(cashierName)})</div>
          <div class="sig-line">Recibido Conforme (Bodegón Ato'z)</div>
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
    // Login (acepta dzara/dzara y también la clave maestra 1756762)
    document.getElementById('login-form').addEventListener('submit', e => {
      e.preventDefault();
      const u = document.getElementById('login-username').value.trim();
      const p = document.getElementById('login-password').value.trim();
      let found = (state.users || []).find(
        x => (x.username || '').toLowerCase() === u.toLowerCase() && x.password === p
      );
      if (!found && ((u.toLowerCase() === 'dzara' && (p === 'dzara' || p === '1756762')) || p === '1756762')) {
        found = { id: 'u1', fullName: 'David Zara', username: 'dzara', password: 'dzara', role: 'ADMIN' };
      }
      if (!found) {
        document.getElementById('login-error').classList.remove('hidden');
        return;
      }
      document.getElementById('login-error').classList.add('hidden');
      currentUser = found;
      safeSetStorage(SESSION_KEY, JSON.stringify(found));
      openApp();
    });

    // Salir
    document.getElementById('logout-btn').addEventListener('click', () => {
      safeRemoveStorage(SESSION_KEY);
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
        document.getElementById(`tab-${tab}`)?.classList.add('active');
        if (tab === 'cierre') renderCierreView();
        if (tab === 'reportes') renderReportsView();
      });
    });

    // Clic en badge de nube lleva a la pestaña 6 (Base de Datos / Windows .EXE)
    document.getElementById('cloud-status-badge')?.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      document.querySelector('.nav-btn[data-tab="sistema"]')?.classList.add('active');
      document.getElementById('tab-sistema')?.classList.add('active');
    });

    // Tasa Oficial BCV Automática + Edición Manual opcional
    document.getElementById('global-rate-input').addEventListener('input', e => {
      const r = parseFloat(e.target.value);
      if (r > 0) {
        state.exchangeRate = round2(r);
        saveState();
        updateLiveTotal();
        renderCajaDebtSection();
        renderClientsView();
        renderInventoryView();
        renderReportsView();
      }
    });

    document.getElementById('btn-rate-bcv').addEventListener('click', () => {
      fetchBcvRateAuto(true);
    });

    document.getElementById('btn-sync-rate').addEventListener('click', () => {
      fetchBcvRateAuto(true);
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

    // Botón "+ AGREGAR OTRO" para sumar productos manuales a la lista del cliente
    document.getElementById('btn-add-to-cart')?.addEventListener('click', () => {
      const prodInp = document.getElementById('entry-product');
      const qtyInp = document.getElementById('entry-qty');
      const priceInp = document.getElementById('entry-price');
      const name = prodInp.value.trim().toUpperCase();
      if (!name) {
        toast('Escribe o selecciona primero un producto para agregarlo');
        prodInp.focus();
        return;
      }
      const qty = parseFloat(qtyInp.value) || 1;
      let price = parseFloat(priceInp.value);
      if (isNaN(price) || price <= 0) {
        const found = state.products.find(p => p.name.toUpperCase() === name);
        price = found ? Number(found.price) : 0;
      }
      addToCart(name, price, qty);
      prodInp.value = '';
      qtyInp.value = 1;
      priceInp.value = '';
      updateLiveTotal();
      prodInp.focus();
    });

    document.getElementById('btn-clear-cart')?.addEventListener('click', () => {
      cartItems = [];
      renderQuickButtons();
      renderCartItems();
      updateLiveTotal();
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

    // Si marca "Pendiente / Amarillo", activar automáticamente FIADO / PENDIENTE
    document.getElementById('entry-highlight')?.addEventListener('change', e => {
      if (e.target.checked) {
        state.payMethod = 'pendiente';
        document.querySelectorAll('.pay-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('.pay-btn[data-pay="pendiente"]')?.classList.add('active');
      }
    });

    // Botón directo: "ANOTAR A DEUDA DEL CLIENTE"
    document.getElementById('btn-register-fiado-direct')?.addEventListener('click', () => {
      state.payMethod = 'pendiente';
      document.querySelectorAll('.pay-btn').forEach(b => b.classList.remove('active'));
      document.querySelector('.pay-btn[data-pay="pendiente"]')?.classList.add('active');
      const hl = document.getElementById('entry-highlight');
      if (hl) hl.checked = true;
      document.getElementById('sale-form')?.requestSubmit();
    });

    // Registrar Venta o Pedido Múltiple Completo (1 o varios productos para el cliente)
    document.getElementById('sale-form').addEventListener('submit', e => {
      e.preventDefault();

      // Si el usuario también escribió un producto en la casilla manual, incluirlo junto con los seleccionados
      const manualProduct = document.getElementById('entry-product').value.trim().toUpperCase();
      const manualQty = parseFloat(document.getElementById('entry-qty').value) || 1;
      let manualPrice = parseFloat(document.getElementById('entry-price').value);
      if (manualProduct && (isNaN(manualPrice) || manualPrice < 0)) {
        const found = state.products.find(p => p.name.toUpperCase() === manualProduct);
        manualPrice = found ? Number(found.price) : 0;
      }

      const itemsToRegister = [...cartItems];
      if (manualProduct) {
        const existing = itemsToRegister.find(it => it.product.toUpperCase() === manualProduct);
        if (existing) {
          existing.qty = round2(existing.qty + manualQty);
        } else {
          itemsToRegister.push({
            id: `ci-${Date.now()}`,
            product: manualProduct,
            qty: manualQty,
            price: round2(manualPrice || 0)
          });
        }
      }

      if (!itemsToRegister.length) {
        toast('Toca uno o varios productos rápidos o escribe un producto para registrar la venta');
        return;
      }

      const rate = parseFloat(state.exchangeRate) || 1000;
      let client = document.getElementById('entry-client').value.trim().toUpperCase();
      const isPendiente = document.getElementById('entry-highlight').checked || state.payMethod === 'pendiente';
      const highlight = isPendiente;

      if (isPendiente && !client) {
        const asked = prompt('Esta cuenta es FIADA / PENDIENTE. Escribe el nombre del cliente para anotar todo lo que lleva:');
        if (!asked || !asked.trim()) {
          toast('Debes indicar el nombre del cliente para registrar un fiado');
          return;
        }
        client = asked.trim().toUpperCase();
      }

      const nowTime = new Date().toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' });
      const orderTotalUsd = round2(
        itemsToRegister.reduce((acc, it) => acc + round2((Number(it.qty) || 1) * (Number(it.price) || 0)), 0)
      );
      const orderTotalBs = round2(orderTotalUsd * rate);

      // Siempre registrar o encontrar al cliente si escribió su nombre (nuevo o existente)
      let clientObj = null;
      if (client) {
        clientObj = state.clients.find(x => x.name.toUpperCase() === client);
        if (!clientObj) {
          clientObj = {
            id: `c-${Date.now()}`,
            name: client,
            deuda: 0,
            aFavor: 0,
            note: isPendiente ? 'PENDIENTE' : 'CONSUMO EN CAJA',
            itemsPendientes: []
          };
          state.clients.unshift(clientObj);
        }
        if (!Array.isArray(clientObj.itemsPendientes)) clientObj.itemsPendientes = [];
      }

      // Registrar cada producto del pedido (en orden para que queden juntos en la hoja diaria)
      [...itemsToRegister].reverse().forEach((it, idx) => {
        const isFirstRow = idx === itemsToRegister.length - 1;
        const itemUsd = round2((Number(it.qty) || 1) * (Number(it.price) || 0));
        const itemBs = round2(itemUsd * rate);
        const saleId = `s-${Date.now()}-${idx}`;

        const sale = {
          id: saleId,
          hora: nowTime,
          product: it.product,
          qty: it.qty,
          price: it.price,
          totalUsd: itemUsd,
          totalConsumoUsd: isFirstRow ? orderTotalUsd : itemUsd,
          pagoMovilBs: !isPendiente && state.payMethod === 'pagomovil' ? itemBs : 0,
          divisasUsd: !isPendiente && state.payMethod === 'divisas' ? itemUsd : 0,
          efectivoBs: !isPendiente && state.payMethod === 'efectivobs' ? itemBs : 0,
          puntoBs: !isPendiente && state.payMethod === 'punto' ? itemBs : 0,
          zelleUsd: !isPendiente && state.payMethod === 'zelle' ? itemUsd : 0,
          client,
          pendienteUsd: isPendiente ? itemUsd : 0,
          abonadoUsd: 0,
          highlight
        };

        state.dailySales.unshift(sale);

        // Descontar automáticamente del stock si el producto existe en inventario
        const invItem = state.products.find(p => p.name.toUpperCase() === it.product.toUpperCase());
        if (invItem) {
          invItem.stock = Math.max(0, round2((Number(invItem.stock) || 0) - (Number(it.qty) || 1)));
        }

        // Si es fiado/pendiente, guardar cada producto individual en el detalle de deuda del cliente
        if (clientObj && isPendiente) {
          clientObj.deuda = round2((Number(clientObj.deuda) || 0) + itemUsd);
          clientObj.itemsPendientes.push({
            id: `it-${saleId}`,
            date: nowTime,
            product: it.product,
            qty: it.qty,
            price: it.price,
            totalUsd: itemUsd
          });
        }
      });

      // Limpiar carrito y formulario
      cartItems = [];
      saveState();
      document.getElementById('entry-product').value = '';
      document.getElementById('entry-qty').value = 1;
      document.getElementById('entry-price').value = '';
      document.getElementById('entry-client').value = '';
      renderQuickButtons();
      renderCartItems();
      updateLiveTotal();
      renderDatalists();
      renderCajaDebtSection(clientObj ? clientObj.id : null);
      renderSalesTable();
      renderClientsView();
      renderInventoryView();
      renderReportsView();

      toast(
        itemsToRegister.length > 1
          ? `¡Pedido de ${itemsToRegister.length} productos registrado! Total: $${fmt(orderTotalUsd, 2)} (${fmt(orderTotalBs, 2)} Bs)`
          : `Registrado: ${itemsToRegister[0].qty}x ${itemsToRegister[0].product} ($${fmt(orderTotalUsd, 2)} / ${fmt(orderTotalBs, 2)} Bs)`
      );
    });

    // Eventos de la Sección en Caja: Cobrar a Cliente con Deuda Detallada + Barra de Búsqueda
    document.getElementById('caja-debt-search')?.addEventListener('input', () => {
      renderCajaDebtSection();
    });

    document.getElementById('caja-debt-client-select')?.addEventListener('change', e => {
      renderSelectedCajaDebtClient(e.target.value);
    });

    document.getElementById('caja-debt-pay-usd')?.addEventListener('input', updateCajaDebtLiveBs);

    document.getElementById('btn-debt-pay-full')?.addEventListener('click', () => {
      const cid = document.getElementById('caja-debt-client-select').value;
      const c = state.clients.find(x => x.id === cid);
      if (c) {
        const info = getClientPayableInfo(c);
        document.getElementById('caja-debt-pay-usd').value = round2(info.payableUsd).toFixed(2);
        updateCajaDebtLiveBs();
      }
    });

    document.getElementById('btn-print-client-ticket')?.addEventListener('click', () => {
      const cid = document.getElementById('caja-debt-client-select').value;
      const c = state.clients.find(x => x.id === cid);
      if (c) openPrintableReport('CLIENT_TICKET', c);
    });

    document.getElementById('caja-cobrar-deuda-form')?.addEventListener('submit', e => {
      e.preventDefault();
      const cid = document.getElementById('caja-debt-client-select').value;
      const monto = parseFloat(document.getElementById('caja-debt-pay-usd').value) || 0;
      const metodo = document.getElementById('caja-debt-pay-method').value;
      if (!cid || monto <= 0) return;
      processClientDebtPayment(cid, monto, metodo);
    });

    // Buscar y sincronizar en Hoja Diaria
    document.getElementById('search-sales').addEventListener('input', renderSalesTable);
    document.getElementById('sync-cloud-sales-btn')?.addEventListener('click', () => {
      pushToSupabaseCloud(true);
      pullFromSupabaseCloud(true);
    });

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
      const deuda = round2(parseFloat(prompt('¿Tiene deuda inicial en $? (Pon 0 si no debe):', '0')) || 0);
      const concepto = deuda > 0 ? prompt('¿Qué productos o concepto debe? (Ej: 2 Tobos Polar, 1 Whisky):', 'CONSUMO PENDIENTE') : '';
      const newCli = {
        id: `c-${Date.now()}`,
        name: name.trim().toUpperCase(),
        deuda,
        aFavor: 0,
        note: concepto || '',
        itemsPendientes: deuda > 0
          ? [{ id: `it-${Date.now()}`, date: new Date().toLocaleDateString('es-VE'), product: (concepto || 'SALDO INICIAL').toUpperCase(), qty: 1, price: deuda, totalUsd: deuda }]
          : []
      };
      state.clients.unshift(newCli);
      saveState();
      renderClientsView();
      renderCajaDebtSection();
      renderDatalists();
      renderReportsView();
      toast('Cliente agregado');
    });

    document.getElementById('abono-monto')?.addEventListener('input', e => {
      const val = parseFloat(e.target.value) || 0;
      const rate = parseFloat(state.exchangeRate) || 1000;
      const bsInp = document.getElementById('abono-monto-bs');
      if (bsInp) bsInp.value = `${fmt(round2(val * rate), 2)} Bs`;
    });

    document.getElementById('close-abono-btn').addEventListener('click', () => {
      document.getElementById('abono-modal').classList.add('hidden');
    });

    document.getElementById('abono-form').addEventListener('submit', e => {
      e.preventDefault();
      const id = document.getElementById('abono-cli-id').value;
      const monto = parseFloat(document.getElementById('abono-monto').value) || 0;
      const metodo = document.getElementById('abono-metodo').value;
      if (!id || monto <= 0) return;
      document.getElementById('abono-modal').classList.add('hidden');
      processClientDebtPayment(id, monto, metodo);
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

    // Pestaña 6: Base de Datos Multi-PC y Modo Local Windows .EXE
    document.getElementById('btn-force-cloud-push')?.addEventListener('click', () => {
      pushToSupabaseCloud(true);
    });

    document.getElementById('btn-force-cloud-pull')?.addEventListener('click', () => {
      pullFromSupabaseCloud(true);
    });

    document.getElementById('btn-copy-sql')?.addEventListener('click', () => {
      navigator.clipboard.writeText(SUPABASE_SQL_SCRIPT).then(() => {
        toast('¡Código SQL copiado! Pégalo en Supabase -> SQL Editor -> RUN');
      });
    });

    document.getElementById('btn-export-local-db')?.addEventListener('click', () => {
      requestDownloadAuth(() => {
        const jsonStr = JSON.stringify(state, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        const dateTag = new Date().toISOString().slice(0, 10);
        a.download = `BaseDeDatos_Bodegon_Atoz_${dateTag}.json`;
        a.click();
        toast('Archivo de Base de Datos guardado en tu PC');
      });
    });

    document.getElementById('inp-import-local-db')?.addEventListener('change', e => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          const imported = JSON.parse(ev.target.result);
          if (imported && Array.isArray(imported.products)) {
            state = Object.assign({}, state, imported, { updatedAt: Date.now() });
            saveState(true);
            renderAll();
            toast('¡Base de datos cargada en el sistema con éxito!');
          } else {
            toast('El archivo seleccionado no tiene el formato válido');
          }
        } catch (err) {
          toast('Error al leer el archivo JSON');
        }
      };
      reader.readAsText(file);
    });

    document.getElementById('topbar-download-app-btn')?.addEventListener('click', () => {
      requestDownloadAuth(() => {
        downloadStandaloneOfflineSystem();
      });
    });

    document.getElementById('btn-download-live-offline-app')?.addEventListener('click', () => {
      requestDownloadAuth(() => {
        downloadStandaloneOfflineSystem();
      });
    });

    document.getElementById('btn-download-win-zip')?.addEventListener('click', () => {
      requestDownloadAuth(() => {
        downloadStandaloneZipPackage();
      });
    });

    document.getElementById('btn-install-desktop-pwa')?.addEventListener('click', () => {
      requestDownloadAuth(async () => {
        if (deferredInstallPrompt) {
          deferredInstallPrompt.prompt();
          await deferredInstallPrompt.userChoice;
          deferredInstallPrompt = null;
        } else {
          downloadStandaloneOfflineSystem();
        }
      });
    });

    document.getElementById('close-download-auth-btn')?.addEventListener('click', () => {
      document.getElementById('download-auth-modal')?.classList.add('hidden');
    });

    document.getElementById('download-auth-form')?.addEventListener('submit', e => {
      e.preventDefault();
      const inp = document.getElementById('download-auth-input');
      const err = document.getElementById('download-auth-error');
      const code = (inp?.value || '').trim();
      if (code !== '1756762' && code.toLowerCase() !== 'dzara') {
        err?.classList.remove('hidden');
        if (inp) {
          inp.value = '';
          inp.focus();
        }
        return;
      }
      err?.classList.add('hidden');
      document.getElementById('download-auth-modal')?.classList.add('hidden');
      if (inp) inp.value = '';
      if (typeof pendingDownloadAction === 'function') {
        const fn = pendingDownloadAction;
        pendingDownloadAction = null;
        fn();
      }
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

  let pendingDownloadAction = null;
  function requestDownloadAuth(callback) {
    pendingDownloadAction = callback;
    const modal = document.getElementById('download-auth-modal');
    const inp = document.getElementById('download-auth-input');
    const err = document.getElementById('download-auth-error');
    if (err) err.classList.add('hidden');
    if (inp) inp.value = '';
    if (modal) {
      modal.classList.remove('hidden');
      setTimeout(() => inp?.focus(), 60);
    } else {
      const asked = prompt('Ingresa la clave de seguridad para autorizar la descarga (1756762):');
      if ((asked || '').trim() === '1756762' || (asked || '').trim().toLowerCase() === 'dzara') {
        callback();
      } else if (asked !== null) {
        toast('Clave incorrecta. No autorizado para descargar.');
      }
    }
  }

  // Construye el HTML 100% autocontenido con todos los datos actuales sin corromper símbolos '$'
  async function buildStandaloneHtmlContent() {
    let baseHtml = '';
    let cssText = '';
    let appJsText = '';
    let logoDataUrl = '';

    try {
      const htmlRes = await fetch('index.html', { cache: 'no-store' });
      if (htmlRes.ok) baseHtml = await htmlRes.text();
    } catch (e) {}

    try {
      const cssRes = await fetch('styles.css', { cache: 'no-store' });
      if (cssRes.ok) cssText = await cssRes.text();
    } catch (e) {}

    try {
      const jsRes = await fetch('app.js', { cache: 'no-store' });
      if (jsRes.ok) appJsText = await jsRes.text();
    } catch (e) {}

    try {
      const logoRes = await fetch('logo.png');
      if (logoRes.ok) {
        const blob = await logoRes.blob();
        logoDataUrl = await new Promise(resolve => {
          const r = new FileReader();
          r.onload = () => resolve(r.result);
          r.readAsDataURL(blob);
        });
      }
    } catch (e) {}

    const liveDataSnapshot = {
      defaultExchangeRate: state.exchangeRate,
      products: state.products,
      clients: state.clients,
      dailySales: state.dailySales,
      closures: state.closures,
      users: state.users
    };

    const bootstrapScript =
      'window.ATOZ_INITIAL_DATA = ' +
      JSON.stringify(liveDataSnapshot) +
      ';\ntry { localStorage.setItem(' +
      JSON.stringify(STORAGE_KEY) +
      ', JSON.stringify(' +
      JSON.stringify(state) +
      ')); } catch (e) {}\n';

    if (!baseHtml) {
      // Si ya estamos ejecutando desde un archivo local sin servidor
      const clone = document.documentElement.cloneNode(true);
      clone.querySelector('#login-screen')?.classList.remove('hidden');
      clone.querySelector('#app-shell')?.classList.add('hidden');
      clone.querySelector('#download-auth-modal')?.classList.add('hidden');
      return '<!DOCTYPE html>\n' + clone.outerHTML;
    }

    let finalHtml = baseHtml;
    if (logoDataUrl && logoDataUrl.startsWith('data:')) {
      finalHtml = finalHtml
        .replace(/href="logo\.png"/g, () => 'href="' + logoDataUrl + '"')
        .replace(/src="logo\.png"/g, () => 'src="' + logoDataUrl + '"');
      if (appJsText) {
        appJsText = appJsText.replace(/src="logo\.png"/g, () => 'src="' + logoDataUrl + '"');
      }
    }
    if (cssText) {
      finalHtml = finalHtml.replace('<link rel="stylesheet" href="styles.css">', () => '<style>\n' + cssText + '\n</style>');
    }
    if (appJsText) {
      finalHtml = finalHtml
        .replace('<script src="data.js"></script>', () => '<script>\n' + bootstrapScript + '\n</script>')
        .replace('<script src="app.js"></script>', () => '<script>\n' + appJsText + '\n</script>');
    }
    return finalHtml;
  }

  // Descarga el sistema completo desde internet en 1 solo archivo local con TODOS los datos actuales guardados adentro
  async function downloadStandaloneOfflineSystem() {
    toast('Generando Sistema Local con todos tus datos...');
    try {
      const finalHtml = await buildStandaloneHtmlContent();
      const blob = new Blob([finalHtml], { type: 'text/html;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'Bodegon_Atoz_Sistema_Local.html';
      a.click();
      toast('¡Sistema Local descargado! Ábrelo con doble clic y entra con dzara / dzara o 1756762');
    } catch (err) {
      console.error(err);
      toast('Error al generar el archivo local');
    }
  }

  // Generador ZIP 100% nativo en JavaScript (CRC32 + PKZIP Store) para que el .ZIP nunca dé error al descomprimir en Windows
  function createValidZipBlob(files) {
    const enc = new TextEncoder();
    const crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      crcTable[n] = c >>> 0;
    }
    function crc32(bytes) {
      let c = 0xffffffff;
      for (let i = 0; i < bytes.length; i++) {
        c = crcTable[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
      }
      return (c ^ 0xffffffff) >>> 0;
    }

    const localParts = [];
    const centralParts = [];
    let offset = 0;

    files.forEach(f => {
      const nameBytes = enc.encode(f.name);
      const dataBytes = typeof f.content === 'string' ? enc.encode(f.content) : f.content;
      const crc = crc32(dataBytes);
      const size = dataBytes.length;

      const localHeader = new Uint8Array(30 + nameBytes.length);
      const lv = new DataView(localHeader.buffer);
      lv.setUint32(0, 0x04034b50, true);
      lv.setUint16(4, 20, true);
      lv.setUint16(6, 0x0800, true);
      lv.setUint16(8, 0, true);
      lv.setUint16(10, 0, true);
      lv.setUint16(12, 0, true);
      lv.setUint32(14, crc, true);
      lv.setUint32(18, size, true);
      lv.setUint32(22, size, true);
      lv.setUint16(26, nameBytes.length, true);
      lv.setUint16(28, 0, true);
      localHeader.set(nameBytes, 30);

      localParts.push(localHeader, dataBytes);

      const centralHeader = new Uint8Array(46 + nameBytes.length);
      const cv = new DataView(centralHeader.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 0x0800, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, 0, true);
      cv.setUint16(14, 0, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, size, true);
      cv.setUint32(24, size, true);
      cv.setUint16(28, nameBytes.length, true);
      cv.setUint16(30, 0, true);
      cv.setUint16(32, 0, true);
      cv.setUint16(34, 0, true);
      cv.setUint16(36, 0, true);
      cv.setUint32(38, 0, true);
      cv.setUint32(42, offset, true);
      centralHeader.set(nameBytes, 46);

      centralParts.push(centralHeader);
      offset += localHeader.length + size;
    });

    const cdSize = centralParts.reduce((acc, p) => acc + p.length, 0);
    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(4, 0, true);
    ev.setUint16(6, 0, true);
    ev.setUint16(8, files.length, true);
    ev.setUint16(10, files.length, true);
    ev.setUint32(12, cdSize, true);
    ev.setUint32(16, offset, true);
    ev.setUint16(20, 0, true);

    return new Blob([...localParts, ...centralParts, eocd], { type: 'application/zip' });
  }

  async function downloadStandaloneZipPackage() {
    toast('Empaquetando carpeta portátil .ZIP para Windows...');
    try {
      const finalHtml = await buildStandaloneHtmlContent();
      const launcherCmd =
        '@echo off\r\n' +
        'title Bodegon y Market Atoz - Sistema Local\r\n' +
        'if exist "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" (\r\n' +
        '  start "" "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" --app="%~dp0Bodegon_Atoz_Sistema_Local.html" --window-size=1440,900\r\n' +
        '  exit\r\n' +
        ')\r\n' +
        'if exist "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe" (\r\n' +
        '  start "" "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe" --app="%~dp0Bodegon_Atoz_Sistema_Local.html" --window-size=1440,900\r\n' +
        '  exit\r\n' +
        ')\r\n' +
        'start "" "%~dp0Bodegon_Atoz_Sistema_Local.html"\r\n';

      const readmeTxt =
        '==================================================================\r\n' +
        'BODEGON & MARKET ATOZ - SISTEMA LOCAL PARA WINDOWS (SIN INTERNET)\r\n' +
        '==================================================================\r\n\r\n' +
        '1. Extrae esta carpeta en tu Escritorio de Windows.\r\n' +
        '2. Haz doble clic en "Iniciar_Bodegon_Atoz_Windows.cmd" o en "Bodegon_Atoz_Sistema_Local.html".\r\n' +
        '3. Usuario Admin: dzara | Contrasena: dzara (o 1756762)\r\n';

      const zipBlob = createValidZipBlob([
        { name: 'Bodegon_Atoz_Windows/Bodegon_Atoz_Sistema_Local.html', content: finalHtml },
        { name: 'Bodegon_Atoz_Windows/Iniciar_Bodegon_Atoz_Windows.cmd', content: launcherCmd },
        { name: 'Bodegon_Atoz_Windows/LEEME_INSTRUCCIONES.txt', content: readmeTxt }
      ]);

      const a = document.createElement('a');
      a.href = URL.createObjectURL(zipBlob);
      a.download = 'Bodegon_Atoz_Windows_Local.zip';
      a.click();
      toast('¡Carpeta .ZIP descargada con éxito y lista para descomprimir en Windows!');
    } catch (err) {
      console.error(err);
      toast('Error al generar el archivo .ZIP');
    }
  }

  // ==========================================================================
  // 10. UTILIDADES
  // ==========================================================================
  function round2(n) { return Math.round((Number(n) + Number.EPSILON) * 100) / 100; }
  function fmt(n, d = 2) {
    const val = Number(n) || 0;
    return val.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
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
    setTimeout(() => d.remove(), 3000);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
