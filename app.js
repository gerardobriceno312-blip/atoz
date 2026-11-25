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
  tipo TEXT DEFAULT 'DIARIO',
  date TEXT NOT NULL,
  cashier TEXT NOT NULL,
  total_eur NUMERIC(12,2) DEFAULT 0,
  euro_rate NUMERIC(12,2) DEFAULT 1080,
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
    exchangeRate: 1085,
    euroRate: 1085,
    euroAnchorMode: 'PARITY_1_1',
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
  // Período activo en la pestaña de Cierres Anclados al Euro: 'DIARIO' | 'SEMANAL' | 'MENSUAL'
  let activeClosurePeriod = 'DIARIO';

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
        navigator.serviceWorker.register('sw.js?v=8').then(reg => {
          try { reg.update(); } catch (e) {}
        }).catch(() => {});
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

  const SUPABASE_SYNC_ROW_ID = '25089649-6a32-4152-b846-c97478622342';
  const SUPABASE_SYNC_EMAIL = 'atoz_pos_cloud@gmail.com';
  const SUPABASE_SYNC_PASS = 'AtozPosCloud1756762!';
  let cachedSupabaseToken = null;
  let cachedSupabaseTokenExp = 0;

  async function getSupabaseSyncToken() {
    const nowSec = Math.floor(Date.now() / 1000);
    if (cachedSupabaseToken && cachedSupabaseTokenExp > nowSec + 60) {
      return cachedSupabaseToken;
    }
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: SUPABASE_SYNC_EMAIL, password: SUPABASE_SYNC_PASS })
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.access_token) {
          cachedSupabaseToken = data.access_token;
          cachedSupabaseTokenExp = nowSec + (Number(data.expires_in) || 3500);
          return cachedSupabaseToken;
        }
      }
    } catch (e) {}
    return SUPABASE_KEY;
  }

  async function pushToSupabaseCloud(manualNotify = false) {
    if (!navigator.onLine) {
      setCloudBadge('Modo Local Sin Internet (Guardado en PC)', false);
      return;
    }
    try {
      const payloadObj = {
        updatedAt: state.updatedAt || Date.now(),
        exchangeRate: state.exchangeRate,
        euroRate: state.euroRate,
        euroAnchorMode: state.euroAnchorMode || 'PARITY_1_1',
        users: state.users,
        products: state.products,
        clients: state.clients,
        dailySales: state.dailySales,
        closures: state.closures
      };

      const token = await getSupabaseSyncToken();

      // 1. Guardar en la tabla activa de Supabase (public.profiles) que ya está creada y conectada
      const resProfile = await fetch(`${SUPABASE_URL}/rest/v1/profiles?on_conflict=id`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates,return=minimal'
        },
        body: JSON.stringify({
          id: SUPABASE_SYNC_ROW_ID,
          full_name: 'ATOZ_POS_CLOUD_STATE',
          approved: true,
          receipt_url: JSON.stringify(payloadObj),
          updated_at: new Date().toISOString()
        })
      });

      // 2. Intentar también en atoz_cloud_state por si existe
      fetch(`${SUPABASE_URL}/rest/v1/atoz_cloud_state?on_conflict=id`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates,return=minimal'
        },
        body: JSON.stringify({
          id: 'principal',
          updated_at: new Date().toISOString(),
          exchange_rate: Number(state.exchangeRate) || 1000,
          payload: payloadObj
        })
      }).catch(() => {});

      if (resProfile.ok) {
        setCloudBadge('Base de Datos Conectada (Nube Activa)', true);
        if (manualNotify) toast('¡Base de datos en la nube sincronizada correctamente!');
      } else {
        setCloudBadge('Guardado en PC Local', false);
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
      const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${SUPABASE_SYNC_ROW_ID}&select=receipt_url,updated_at`, {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        },
        cache: 'no-store'
      });

      if (!res.ok) {
        setCloudBadge('Guardado en PC Local', false);
        return;
      }

      const rows = await res.json();
      let cloudData = null;
      if (Array.isArray(rows) && rows.length > 0 && rows[0].receipt_url) {
        try {
          const parsed = JSON.parse(rows[0].receipt_url);
          if (parsed && Array.isArray(parsed.products)) {
            cloudData = parsed;
          }
        } catch (e) {}
      }

      if (cloudData) {
        const cloudTime = Number(cloudData.updatedAt) || 0;
        const localTime = Number(state.updatedAt) || 0;

        if (manualNotify || cloudTime > localTime) {
          state.updatedAt = cloudTime || Date.now();
          if (Array.isArray(cloudData.products) && cloudData.products.length) state.products = cloudData.products;
          if (Array.isArray(cloudData.clients) && cloudData.clients.length) state.clients = cloudData.clients;
          if (Array.isArray(cloudData.dailySales)) state.dailySales = cloudData.dailySales;
          if (Array.isArray(cloudData.closures)) state.closures = cloudData.closures;
          if (Array.isArray(cloudData.users) && cloudData.users.length) state.users = cloudData.users;
          if (Number(cloudData.exchangeRate) > 0) state.exchangeRate = Number(cloudData.exchangeRate);
          if (Number(cloudData.euroRate) > 0) state.euroRate = Number(cloudData.euroRate);
          if (cloudData.euroAnchorMode) state.euroAnchorMode = cloudData.euroAnchorMode;

          ensureClientsItemizedDebt();
          safeSetStorage(STORAGE_KEY, JSON.stringify(state));
          if (currentUser) renderAll();
          if (manualNotify) toast('¡Ventas, cierres, clientes e inventario actualizados desde la Base de Datos!');
        } else if (localTime > cloudTime) {
          pushToSupabaseCloud(false);
        }
        setCloudBadge('Base de Datos Conectada (Nube Activa)', true);
      } else {
        // Subir estado completo inicial a la base de datos conectada
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
    if (!Number(state.euroRate) || Number(state.euroRate) <= 0) {
      state.euroRate = round2((Number(state.exchangeRate) || 1000) * 1.085);
    }
    document.getElementById('global-rate-input').value = Number(state.exchangeRate).toFixed(2);
    const eurInp = document.getElementById('global-euro-rate-input');
    if (eurInp) eurInp.value = Number(state.euroRate).toFixed(2);
    const monthPicker = document.getElementById('cierre-month-picker');
    if (monthPicker && !monthPicker.value) {
      monthPicker.value = new Date().toISOString().slice(0, 7);
    }
    const modeSel = document.getElementById('cierre-euro-mode-select');
    if (modeSel) modeSel.value = state.euroAnchorMode || 'BCV_CONVERT';

    document.querySelectorAll('.admin-only').forEach(el => {
      el.classList.toggle('hidden', currentUser.role !== 'ADMIN');
    });

    renderAll();
    fetchBcvRateAuto(true);
    setInterval(() => fetchBcvRateAuto(false), 15 * 60 * 1000);
  }

  // ==========================================================================
  // 1B. ACTUALIZACIÓN 100% AUTOMÁTICA DE TASA OFICIAL BCV ($ Y € EURO) POR API
  // ==========================================================================
  let liveBcvRate = null;
  let liveEuroBcvRate = null;

  async function fetchBcvRateAuto(showToastOnSuccess = true) {
    const icon = document.getElementById('sync-rate-icon');
    const lbl = document.getElementById('lbl-rate-bcv');
    const lblEur = document.getElementById('lbl-rate-eur');
    if (!navigator.onLine) {
      if (lbl) lbl.textContent = `${fmt(state.exchangeRate, 2)} Bs`;
      if (lblEur) lblEur.textContent = `${fmt(state.euroRate || round2(state.exchangeRate * 1.085), 2)} Bs`;
      return;
    }
    if (icon) icon.classList.add('spin');

    let fetchedRate = null;
    let fetchedEuroRate = null;

    // Intento 1: Endpoint directo oficial BCV DolarApi ($)
    try {
      const res = await fetch('https://ve.dolarapi.com/v1/dolares/oficial', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data && Number(data.promedio) > 0) {
          fetchedRate = round2(Number(data.promedio));
        }
      }
    } catch (e) {}

    // Intento 2: Lista general DolarApi (solo oficial $)
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

    // Intento 3: API Internacional ExchangeRate (VES oficial por USD y relación EUR)
    let internationalEurUsdRatio = null;
    try {
      const res3 = await fetch('https://open.er-api.com/v6/latest/USD', { cache: 'no-store' });
      if (res3.ok) {
        const fb = await res3.json();
        if (fb && fb.rates) {
          if (!fetchedRate && Number(fb.rates.VES) > 0) {
            fetchedRate = round2(Number(fb.rates.VES));
          }
          if (Number(fb.rates.EUR) > 0) {
            internationalEurUsdRatio = 1 / Number(fb.rates.EUR);
          }
        }
      }
    } catch (e) {}

    // Intentos para Tasa Oficial EURO BCV (€)
    try {
      const resEur1 = await fetch('https://ve.dolarapi.com/v1/euros/oficial', { cache: 'no-store' });
      if (resEur1.ok) {
        const dataEur = await resEur1.json();
        if (dataEur && Number(dataEur.promedio) > 0) {
          fetchedEuroRate = round2(Number(dataEur.promedio));
        }
      }
    } catch (e) {}

    if (!fetchedEuroRate) {
      try {
        const resEur2 = await fetch('https://ve.dolarapi.com/v1/euros', { cache: 'no-store' });
        if (resEur2.ok) {
          const listEur = await resEur2.json();
          const ofiEur = Array.isArray(listEur) ? listEur.find(d => d.fuente === 'oficial') : null;
          if (ofiEur && Number(ofiEur.promedio) > 0) {
            fetchedEuroRate = round2(Number(ofiEur.promedio));
          }
        }
      } catch (e) {}
    }

    if (!fetchedEuroRate) {
      try {
        const resEur3 = await fetch('https://open.er-api.com/v6/latest/EUR', { cache: 'no-store' });
        if (resEur3.ok) {
          const fbEur = await resEur3.json();
          if (fbEur && fbEur.rates) {
            if (Number(fbEur.rates.VES) > 0) {
              fetchedEuroRate = round2(Number(fbEur.rates.VES));
            } else if (Number(fbEur.rates.USD) > 0 && (fetchedRate || state.exchangeRate)) {
              fetchedEuroRate = round2((fetchedRate || state.exchangeRate) * Number(fbEur.rates.USD));
            }
          }
        }
      } catch (e) {}
    }

    // Si obtuvimos la tasa BCV USD y la relación internacional EUR/USD pero no un endpoint directo de Euro
    const baseUsd = fetchedRate || Number(state.exchangeRate) || 1000;
    if (!fetchedEuroRate && baseUsd > 0) {
      const ratio = internationalEurUsdRatio && internationalEurUsdRatio > 1 ? internationalEurUsdRatio : 1.085;
      fetchedEuroRate = round2(baseUsd * ratio);
    }

    if (icon) icon.classList.remove('spin');

    if (fetchedEuroRate && fetchedEuroRate > 0) {
      liveEuroBcvRate = fetchedEuroRate;
      state.euroRate = round2(fetchedEuroRate);
      // Todo el sistema se maneja en Bolívares y a Tasa Oficial Euro BCV
      state.exchangeRate = state.euroRate;
      if (lblEur) lblEur.textContent = `${fmt(state.euroRate, 2)} Bs/€`;
      const eurInp = document.getElementById('global-euro-rate-input');
      if (eurInp) eurInp.value = state.euroRate.toFixed(2);
      applyBcvExchangeRate(state.euroRate, showToastOnSuccess);
    } else if (fetchedRate && fetchedRate > 0) {
      liveBcvRate = fetchedRate;
      const calcEur = round2(fetchedRate * 1.085);
      state.euroRate = calcEur;
      state.exchangeRate = calcEur;
      if (lblEur) lblEur.textContent = `${fmt(state.euroRate, 2)} Bs/€`;
      applyBcvExchangeRate(state.euroRate, showToastOnSuccess);
    } else {
      if (lblEur) lblEur.textContent = `${fmt(state.euroRate || state.exchangeRate, 2)} Bs/€`;
      renderCierreView();
    }
  }

  function applyBcvExchangeRate(newRate, notify = true) {
    if (!newRate || newRate <= 0) return;
    state.euroRate = round2(newRate);
    state.exchangeRate = round2(newRate);
    const inp = document.getElementById('global-rate-input');
    if (inp) inp.value = state.exchangeRate.toFixed(2);
    const eurInp = document.getElementById('global-euro-rate-input');
    if (eurInp) eurInp.value = Number(state.euroRate).toFixed(2);
    const bcvBtn = document.getElementById('btn-rate-bcv');
    if (bcvBtn) bcvBtn.classList.add('active');
    saveState();
    updateLiveTotal();
    renderCajaDebtSection();
    renderSalesTable();
    renderCierreView();
    renderClientsView();
    renderInventoryView();
    renderReportsView();
    if (notify) {
      toast(`Tasa Oficial Euro BCV activa en todo el sistema: ${fmt(state.euroRate, 2)} Bs/€`);
    }
  }

  function renderAll() {
    ensureClientsItemizedDebt();
    if (!Number(state.euroRate) || Number(state.euroRate) <= 0) {
      state.euroRate = round2((Number(state.exchangeRate) || 1000) * 1.085);
    }
    // Garantizar que toda la tasa del sistema esté anclada al Euro BCV
    state.exchangeRate = round2(Number(state.euroRate));
    if (!state.euroAnchorMode) state.euroAnchorMode = 'PARITY_1_1';
    const inp = document.getElementById('global-rate-input');
    if (inp) inp.value = Number(state.exchangeRate).toFixed(2);
    const eurInp = document.getElementById('global-euro-rate-input');
    if (eurInp) eurInp.value = Number(state.euroRate).toFixed(2);
    const lblEur = document.getElementById('lbl-rate-eur');
    if (lblEur) lblEur.textContent = `${fmt(state.euroRate, 2)} Bs/€`;
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
  // 2. CAJA DIARIA + SELECCIÓN MÚLTIPLE DE PRODUCTOS + COBRO DE DEUDAS (EN BS Y TASA EURO)
  // ==========================================================================
  function renderDatalists() {
    const rate = getEuroRate();
    document.getElementById('datalist-products').innerHTML = state.products
      .map(p => `<option value="${esc(p.name)}">${fmt(round2((Number(p.price) || 0) * rate), 2)} Bs (€${Number(p.price).toFixed(2)} • Stock: ${p.stock ?? 0})</option>`)
      .join('');

    document.getElementById('datalist-clients').innerHTML = state.clients
      .map(c => `<option value="${esc(c.name)}">${c.deuda > 0 ? 'Debe ' + fmt(round2(c.deuda * rate), 2) + ' Bs (€' + fmt(c.deuda, 2) + ')' : ''}</option>`)
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
    const rate = getEuroRate();
    grid.innerHTML = quicks
      .map(p => {
        const inCart = cartItems.find(it => it.product.toUpperCase() === (p.name || '').toUpperCase());
        const priceBs = round2((Number(p.price) || 0) * rate);
        return `
      <button type="button" class="q-btn ${inCart ? 'in-cart' : ''}" data-name="${esc(p.name)}" data-price="${p.price}">
        <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
          <strong>${esc(p.name)}</strong>
          ${inCart ? `<span class="q-cart-badge">x${inCart.qty}</span>` : ''}
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
          <span>${fmt(priceBs, 2)} Bs <small style="color:#93C5FD;">(€${fmt(p.price, 2)})</small></span>
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
          <td><strong class="text-gold">${fmt(subBs, 2)} Bs</strong></td>
          <td><strong style="color:#93C5FD;">€${fmt(subUsd, 2)}</strong></td>
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
    const rate = getEuroRate();
    const totalBs = round2(totalUsd * rate);

    document.getElementById('display-total-usd').textContent = `€${fmt(totalUsd, 2)}`;
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
          return `<option value="${c.id}" ${c.id === activeId ? 'selected' : ''}>${esc(c.name)} — ${tag}: ${fmt(round2(info.amountUsd * rate), 2)} Bs (€${fmt(info.amountUsd, 2)})</option>`;
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
    const rate = getEuroRate();
    const totalDeudaUsd = round2(info.amountUsd);
    const totalDeudaBs = round2(totalDeudaUsd * rate);

    document.getElementById('debt-cli-name').textContent = c.name;
    const badgeEl = document.getElementById('debt-cli-badge');
    if (badgeEl) {
      badgeEl.textContent = info.isFromDailySheetOnly ? 'COMPRA EN HOJA DIARIA' : totalDeudaUsd > 0 ? 'DEUDA PENDIENTE' : 'AL DÍA';
    }
    document.getElementById('debt-total-usd').textContent = `€${fmt(totalDeudaUsd, 2)}`;
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
          <td>€${fmt(it.price, 2)}</td>
          <td><strong class="${subUsd < 0 ? 'text-green' : 'text-yellow'}">€${fmt(subUsd, 2)}</strong></td>
          <td><strong class="text-gold">${fmt(subBs, 2)} Bs</strong></td>
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
    const rate = getEuroRate();
    const totalVentasBs = round2(t.usd * rate);
    const totalPendBs = round2(t.pendUsd * rate);

    document.getElementById('sum-total-usd').textContent = `${fmt(totalVentasBs, 2)} Bs (€${fmt(t.usd, 2)})`;
    document.getElementById('sum-punto-bs').textContent = `${fmt(t.puntoBs, 2)} Bs`;
    document.getElementById('sum-pm-bs').textContent = `${fmt(t.pmBs, 2)} Bs`;
    document.getElementById('sum-divisas-usd').textContent = `€${fmt(t.divUsd, 2)} (${fmt(round2(t.divUsd * rate), 2)} Bs)`;
    document.getElementById('sum-ef-zelle').textContent = `${fmt(t.efBs, 2)} Bs / €${fmt(t.zelleUsd, 2)}`;
    document.getElementById('sum-pendiente-usd').textContent = `${fmt(totalPendBs, 2)} Bs (€${fmt(t.pendUsd, 2)})`;

    const search = (document.getElementById('search-sales').value || '').toLowerCase();
    const list = state.dailySales.filter(s => {
      if (!search) return true;
      return (s.product || '').toLowerCase().includes(search) || (s.client || '').toLowerCase().includes(search);
    });

    const tbody = document.getElementById('sales-tbody');
    tbody.innerHTML = list
      .map(s => {
        const rowBs = round2((Number(s.totalUsd) || 0) * rate);
        const unitBs = round2((Number(s.price) || 0) * rate);
        const pendBs = round2((Number(s.pendienteUsd) || 0) * rate);
        const abonBs = round2((Number(s.abonadoUsd) || 0) * rate);
        return `
      <tr class="${s.highlight ? 'row-yellow' : ''}">
        <td style="text-align:left;"><strong>${esc(s.product)}</strong></td>
        <td>${s.qty ?? ''}</td>
        <td>${fmt(unitBs, 2)} Bs <small style="opacity:0.8;">(€${fmt(s.price, 2)})</small></td>
        <td><strong>${fmt(rowBs, 2)} Bs</strong></td>
        <td><strong style="color:#93C5FD;">€${fmt(s.totalUsd, 2)}</strong></td>
        <td>${s.pagoMovilBs > 0 ? fmt(s.pagoMovilBs, 2) + ' Bs' : ''}</td>
        <td>${s.divisasUsd > 0 ? '€' + fmt(s.divisasUsd, 2) : ''}</td>
        <td>${s.efectivoBs > 0 ? fmt(s.efectivoBs, 2) + ' Bs' : ''}</td>
        <td>${s.puntoBs > 0 ? fmt(s.puntoBs, 2) + ' Bs' : ''}</td>
        <td>${s.zelleUsd > 0 ? '€' + fmt(s.zelleUsd, 2) : ''}</td>
        <td style="text-align:left;"><strong>${esc(s.client || '')}</strong></td>
        <td>${s.pendienteUsd > 0 ? fmt(pendBs, 2) + ' Bs (€' + fmt(s.pendienteUsd, 2) + ')' : ''}</td>
        <td>${s.abonadoUsd > 0 ? fmt(abonBs, 2) + ' Bs (€' + fmt(s.abonadoUsd, 2) + ')' : ''}</td>
        <td>
          <button type="button" class="mini-btn btn-hl" data-id="${s.id}" title="Resaltar Amarillo"><i class="fa-solid fa-highlighter"></i></button>
          <button type="button" class="mini-btn btn-del" data-id="${s.id}" title="Borrar"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>
    `;
      })
      .join('');

    document.getElementById('sales-tfoot').innerHTML = `
      <tr>
        <td colspan="3" style="text-align:left;">TOTALES DEL DÍA EN BOLÍVARES Y EUROS (${state.dailySales.length} registros)</td>
        <td>${fmt(totalVentasBs, 2)} Bs</td>
        <td>€${fmt(t.usd, 2)}</td>
        <td>${fmt(t.pmBs, 2)} Bs</td>
        <td>€${fmt(t.divUsd, 2)}</td>
        <td>${fmt(t.efBs, 2)} Bs</td>
        <td>${fmt(t.puntoBs, 2)} Bs</td>
        <td>€${fmt(t.zelleUsd, 2)}</td>
        <td></td>
        <td>${fmt(totalPendBs, 2)} Bs (€${fmt(t.pendUsd, 2)})</td>
        <td>${fmt(round2(t.abonUsd * rate), 2)} Bs (€${fmt(t.abonUsd, 2)})</td>
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

    renderCajaEuroRenglon();
  }

  // ==========================================================================
  // 3. CIERRES DIARIO, SEMANAL Y MENSUAL ANCLADOS AL EURO (€ BCV)
  // ==========================================================================
  function getUsdRate() {
    return parseFloat(state.exchangeRate) || 1000;
  }

  function getEuroRate() {
    const eur = parseFloat(state.euroRate);
    if (eur && eur > 0) return round2(eur);
    return round2(getUsdRate() * 1.085);
  }

  // Extrae fecha/mes/timestamp de un cierre guardado
  function parseClosureDateInfo(c) {
    if (c.timestamp && Number(c.timestamp) > 0) {
      const d = new Date(Number(c.timestamp));
      if (!isNaN(d.getTime())) {
        return {
          ts: d.getTime(),
          isoDate: c.isoDate || d.toISOString().slice(0, 10),
          yearMonth: c.yearMonth || d.toISOString().slice(0, 7)
        };
      }
    }
    if (c.id && c.id.startsWith('cl-')) {
      const parts = c.id.split('-');
      const num = parseInt(parts[1], 10);
      if (!isNaN(num) && num > 1000000000000) {
        const d = new Date(num);
        return {
          ts: d.getTime(),
          isoDate: c.isoDate || d.toISOString().slice(0, 10),
          yearMonth: c.yearMonth || d.toISOString().slice(0, 7)
        };
      }
    }
    const now = new Date();
    return {
      ts: now.getTime(),
      isoDate: c.isoDate || now.toISOString().slice(0, 10),
      yearMonth: c.yearMonth || now.toISOString().slice(0, 7)
    };
  }

  // Calcula todos los montos en Euros (€ BCV), Bolívares (Bs) y Dólares ($)
  function enrichTotalsWithEuro(rawTotals, customEuroRate = null, customUsdRate = null) {
    const euroRate = customEuroRate && customEuroRate > 0 ? round2(customEuroRate) : getEuroRate();
    const usdRate = customUsdRate && customUsdRate > 0 ? round2(customUsdRate) : getUsdRate();
    const mode = state.euroAnchorMode || 'BCV_CONVERT';

    const usd = round2(Number(rawTotals.usd) || 0);
    const puntoBs = round2(Number(rawTotals.puntoBs) || 0);
    const pmBs = round2(Number(rawTotals.pmBs) || 0);
    const efBs = round2(Number(rawTotals.efBs) || 0);
    const divUsd = round2(Number(rawTotals.divUsd) || 0);
    const zelleUsd = round2(Number(rawTotals.zelleUsd) || 0);
    const pendUsd = round2(Number(rawTotals.pendUsd) || 0);
    const abonUsd = round2(Number(rawTotals.abonUsd) || 0);

    const totalBs = round2(puntoBs + pmBs + efBs);
    const totalDivUsd = round2(divUsd + zelleUsd);

    const bsToEur = valBs => (euroRate > 0 ? round2((Number(valBs) || 0) / euroRate) : 0);
    const usdToEur = valUsd => {
      const v = Number(valUsd) || 0;
      if (mode === 'PARITY_1_1') return round2(v);
      return euroRate > 0 ? round2((v * usdRate) / euroRate) : 0;
    };

    const eur = mode === 'PARITY_1_1' ? round2(usd) : usdToEur(usd);
    const parityBs = round2(usd * euroRate);
    const convertedBs = round2(usd * usdRate);
    const anchoredBs = mode === 'PARITY_1_1' ? parityBs : convertedBs;

    return {
      usd,
      eur,
      anchoredBs,
      parityBs,
      convertedBs,
      totalBs,
      totalBsInEur: bsToEur(totalBs),
      totalDivUsd,
      totalDivInEur: usdToEur(totalDivUsd),
      puntoBs,
      puntoEur: bsToEur(puntoBs),
      pmBs,
      pmEur: bsToEur(pmBs),
      efBs,
      efEur: bsToEur(efBs),
      divUsd,
      divEur: usdToEur(divUsd),
      zelleUsd,
      zelleEur: usdToEur(zelleUsd),
      pendUsd,
      pendEur: usdToEur(pendUsd),
      abonUsd,
      abonEur: usdToEur(abonUsd),
      euroRate,
      usdRate,
      mode
    };
  }

  function formatMonthLabel(ym) {
    if (!ym || !ym.includes('-')) return 'Mes Actual';
    const [y, m] = ym.split('-');
    const names = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const idx = Math.max(0, Math.min(11, parseInt(m, 10) - 1));
    return `${names[idx]} ${y}`;
  }

  // Analiza una lista de ventas y devuelve unidades, costos, ganancias, productos consolidados y detalle línea por línea en Bs y € BCV
  function buildSalesDetailedAnalytics(salesList, euroRate) {
    const rate = euroRate && euroRate > 0 ? round2(euroRate) : getEuroRate();
    let totalUnits = 0;
    let totalCostEur = 0;
    let totalProfitEur = 0;
    const prodMap = {};
    const salesDetail = [];

    (salesList || []).forEach(s => {
      const prodName = (s.product || 'PRODUCTO').trim().toUpperCase();
      const qty = round2(Number(s.qty) || 0);
      const revEur = round2(Number(s.totalUsd) || 0);
      const revBs = round2(revEur * rate);
      const unitPriceEur = round2(Number(s.price) || (qty > 0 ? revEur / qty : 0));
      const unitPriceBs = round2(unitPriceEur * rate);

      // Determinar costo unitario del producto en el catálogo
      const invObj = state.products.find(p => (p.name || '').trim().toUpperCase() === prodName);
      const category = invObj ? invObj.category || 'NACIONAL' : 'CAJA / OTRO';
      const unitCostEur = invObj && Number(invObj.cost) > 0 ? round2(Number(invObj.cost)) : round2(unitPriceEur * 0.58);
      const isDebtAbonoRow = prodName.startsWith('COBRO DEUDA:') || (revEur <= 0 && Number(s.abonadoUsd) > 0);

      const rowCostEur = isDebtAbonoRow ? 0 : round2(unitCostEur * qty);
      const rowProfitEur = isDebtAbonoRow ? 0 : round2(Math.max(0, revEur - rowCostEur));

      if (!isDebtAbonoRow && revEur > 0) {
        totalUnits = round2(totalUnits + qty);
        totalCostEur = round2(totalCostEur + rowCostEur);
        totalProfitEur = round2(totalProfitEur + rowProfitEur);

        if (!prodMap[prodName]) {
          prodMap[prodName] = {
            product: prodName,
            category,
            qty: 0,
            unitPriceEur,
            unitPriceBs,
            totalEur: 0,
            totalBs: 0,
            costEur: 0,
            costBs: 0,
            profitEur: 0,
            profitBs: 0
          };
        }
        prodMap[prodName].qty = round2(prodMap[prodName].qty + qty);
        prodMap[prodName].totalEur = round2(prodMap[prodName].totalEur + revEur);
        prodMap[prodName].totalBs = round2(prodMap[prodName].totalEur * rate);
        prodMap[prodName].costEur = round2(prodMap[prodName].costEur + rowCostEur);
        prodMap[prodName].costBs = round2(prodMap[prodName].costEur * rate);
        prodMap[prodName].profitEur = round2(prodMap[prodName].profitEur + rowProfitEur);
        prodMap[prodName].profitBs = round2(prodMap[prodName].profitEur * rate);
      }

      // Determinar etiqueta de método de pago de esta fila
      const methods = [];
      if (Number(s.puntoBs) > 0) methods.push(`Punto (${fmt(s.puntoBs, 2)} Bs)`);
      if (Number(s.pagoMovilBs) > 0) methods.push(`Pago Móvil (${fmt(s.pagoMovilBs, 2)} Bs)`);
      if (Number(s.efectivoBs) > 0) methods.push(`Efectivo (${fmt(s.efectivoBs, 2)} Bs)`);
      if (Number(s.divisasUsd) > 0) methods.push(`Divisas (€${fmt(s.divisasUsd, 2)})`);
      if (Number(s.zelleUsd) > 0) methods.push(`Zelle (€${fmt(s.zelleUsd, 2)})`);
      if (Number(s.pendienteUsd) > 0 || s.highlight) methods.push(`Fiado / Pendiente`);
      if (Number(s.abonadoUsd) > 0 && !methods.length) methods.push(`Abono (€${fmt(s.abonadoUsd, 2)})`);

      const isPend = Number(s.pendienteUsd) > 0 || Boolean(s.highlight);
      const displayEur = revEur > 0 ? revEur : round2(Number(s.abonadoUsd) || 0);
      const displayBs = round2(displayEur * rate);

      salesDetail.push({
        date: s.hora || s.time || 'Hoy',
        product: prodName,
        qty,
        totalEur: displayEur,
        totalBs: displayBs,
        methodLabel: methods.length ? methods.join(' + ') : 'Registrado en Hoja',
        client: s.client || 'CONTADO',
        isPending: isPend,
        isAbono: isDebtAbonoRow
      });
    });

    const productsDetail = Object.values(prodMap).sort((a, b) => b.totalEur - a.totalEur);
    return {
      totalUnits,
      totalCostEur,
      totalCostBs: round2(totalCostEur * rate),
      totalProfitEur,
      totalProfitBs: round2(totalProfitEur * rate),
      productsDetail,
      salesDetail
    };
  }

  // Obtiene el resumen completo y TODOS LOS DETALLES para 'DIARIO', 'SEMANAL' o 'MENSUAL' en Bs y Tasa Euro BCV
  function getClosurePeriodSummary(periodType = 'DIARIO', selectedMonthStr = null) {
    const now = new Date();
    const todayIso = now.toISOString().slice(0, 10);
    const currentYm = now.toISOString().slice(0, 7);
    const targetYm = selectedMonthStr || document.getElementById('cierre-month-picker')?.value || currentYm;
    const euroRate = getEuroRate();
    const liveTotals = getTotals();
    const hasLiveSales =
      state.dailySales.length > 0 &&
      (liveTotals.usd > 0 ||
        liveTotals.puntoBs > 0 ||
        liveTotals.pmBs > 0 ||
        liveTotals.efBs > 0 ||
        liveTotals.divUsd > 0 ||
        liveTotals.zelleUsd > 0 ||
        liveTotals.abonUsd > 0);

    const dailyClosures = (state.closures || []).filter(c => (c.tipo || 'DIARIO') === 'DIARIO');

    // Lista de clientes con deuda detallada actual
    const clientsDetail = (state.clients || [])
      .filter(c => (Number(c.deuda) || 0) > 0)
      .sort((a, b) => (Number(b.deuda) || 0) - (Number(a.deuda) || 0))
      .map(c => {
        const dEur = round2(Number(c.deuda) || 0);
        const dBs = round2(dEur * euroRate);
        const itemsText =
          Array.isArray(c.itemsPendientes) && c.itemsPendientes.length
            ? c.itemsPendientes
                .map(it => `${it.qty || 1}x ${it.product} (${fmt(round2((Number(it.totalUsd) || 0) * euroRate), 2)} Bs / €${fmt(it.totalUsd, 2)})`)
                .join(' • ')
            : 'Saldo pendiente acumulado en cuenta';
        return {
          name: c.name,
          deudaEur: dEur,
          deudaBs: dBs,
          itemsText
        };
      });

    if (periodType === 'DIARIO') {
      const selectedDayIso = (document.getElementById('cierre-day-picker')?.value || '').trim();
      // Si el usuario eligió un día específico en el filtro de días distinto a hoy, mostrar los cierres de ese día
      if (selectedDayIso && selectedDayIso !== todayIso) {
        const dayClosures = dailyClosures.filter(c => parseClosureDateInfo(c).isoDate === selectedDayIso);
        const accDay = { usd: 0, puntoBs: 0, pmBs: 0, efBs: 0, divUsd: 0, zelleUsd: 0, pendUsd: 0, abonUsd: 0 };
        let daySales = [];
        dayClosures.forEach(c => {
          accDay.usd = round2(accDay.usd + (Number(c.totalUsd) || 0));
          accDay.puntoBs = round2(accDay.puntoBs + (Number(c.puntoBs) || 0));
          accDay.pmBs = round2(accDay.pmBs + (Number(c.pmBs) || 0));
          accDay.efBs = round2(accDay.efBs + (Number(c.efBs) || 0));
          accDay.divUsd = round2(accDay.divUsd + (Number(c.divUsd) || 0));
          accDay.zelleUsd = round2(accDay.zelleUsd + (Number(c.zelleUsd) || 0));
          accDay.pendUsd = round2(accDay.pendUsd + (Number(c.pendUsd) || 0));
          accDay.abonUsd = round2(accDay.abonUsd + (Number(c.abonUsd) || 0));
          if (Array.isArray(c.salesSnapshot)) daySales = daySales.concat(c.salesSnapshot);
        });
        const enrDay = enrichTotalsWithEuro(accDay);
        const anDay = buildSalesDetailedAnalytics(daySales, enrDay.euroRate);
        enrDay.totalUnits = anDay.totalUnits;
        enrDay.costEur = anDay.totalCostEur;
        enrDay.costBs = anDay.totalCostBs;
        enrDay.profitEur = anDay.totalProfitEur;
        enrDay.profitBs = anDay.totalProfitBs;
        return {
          periodType: 'DIARIO',
          title: '1. CIERRE DIARIO',
          badgeClass: '',
          periodLabel: `Día: ${selectedDayIso}`,
          opsCount: `${dayClosures.length} cierres ese día • ${fmt(anDay.totalUnits, 0)} unds`,
          daysBreakdown: [],
          productsDetail: anDay.productsDetail,
          salesDetail: anDay.salesDetail,
          clientsDetail,
          totals: enrDay
        };
      }

      const enriched = enrichTotalsWithEuro(liveTotals);
      const analytics = buildSalesDetailedAnalytics(state.dailySales, enriched.euroRate);
      enriched.totalUnits = analytics.totalUnits;
      enriched.costEur = analytics.totalCostEur;
      enriched.costBs = analytics.totalCostBs;
      enriched.profitEur = analytics.totalProfitEur;
      enriched.profitBs = analytics.totalProfitBs;
      enriched.marginPct = enriched.eur > 0 ? Math.round((enriched.profitEur / enriched.eur) * 100) : 0;

      const daysBreakdown = [
        {
          label: `Turno Actual (${now.toLocaleDateString('es-VE')})`,
          tipo: 'DIARIO (EN VIVO)',
          units: analytics.totalUnits,
          eur: enriched.eur,
          anchoredBs: enriched.anchoredBs,
          costEur: analytics.totalCostEur,
          costBs: analytics.totalCostBs,
          profitEur: analytics.totalProfitEur,
          profitBs: analytics.totalProfitBs,
          euroRate: enriched.euroRate
        }
      ];
      return {
        periodType: 'DIARIO',
        title: '1. CIERRE DIARIO (HOY)',
        badgeClass: '',
        periodLabel: `Hoy (${now.toLocaleDateString('es-VE')})`,
        opsCount: `${state.dailySales.length} operaciones • ${fmt(analytics.totalUnits, 0)} unds`,
        daysBreakdown,
        productsDetail: analytics.productsDetail,
        salesDetail: analytics.salesDetail,
        clientsDetail,
        totals: enriched
      };
    }

    if (periodType === 'TODOS') {
      const selectedDayIso = (document.getElementById('cierre-day-picker')?.value || '').trim();
      const targetClosures = selectedDayIso
        ? (state.closures || []).filter(c => parseClosureDateInfo(c).isoDate === selectedDayIso)
        : (state.closures || []);

      const accAll = { usd: 0, puntoBs: 0, pmBs: 0, efBs: 0, divUsd: 0, zelleUsd: 0, pendUsd: 0, abonUsd: 0 };
      let allSalesCombined = [];

      if ((!selectedDayIso || selectedDayIso === todayIso) && hasLiveSales) {
        accAll.usd = round2(accAll.usd + liveTotals.usd);
        accAll.puntoBs = round2(accAll.puntoBs + liveTotals.puntoBs);
        accAll.pmBs = round2(accAll.pmBs + liveTotals.pmBs);
        accAll.efBs = round2(accAll.efBs + liveTotals.efBs);
        accAll.divUsd = round2(accAll.divUsd + liveTotals.divUsd);
        accAll.zelleUsd = round2(accAll.zelleUsd + liveTotals.zelleUsd);
        accAll.pendUsd = round2(accAll.pendUsd + liveTotals.pendUsd);
        accAll.abonUsd = round2(accAll.abonUsd + liveTotals.abonUsd);
        allSalesCombined = allSalesCombined.concat(state.dailySales);
      }

      targetClosures.forEach(c => {
        accAll.usd = round2(accAll.usd + (Number(c.totalUsd) || 0));
        accAll.puntoBs = round2(accAll.puntoBs + (Number(c.puntoBs) || 0));
        accAll.pmBs = round2(accAll.pmBs + (Number(c.pmBs) || 0));
        accAll.efBs = round2(accAll.efBs + (Number(c.efBs) || 0));
        accAll.divUsd = round2(accAll.divUsd + (Number(c.divUsd) || 0));
        accAll.zelleUsd = round2(accAll.zelleUsd + (Number(c.zelleUsd) || 0));
        accAll.pendUsd = round2(accAll.pendUsd + (Number(c.pendUsd) || 0));
        accAll.abonUsd = round2(accAll.abonUsd + (Number(c.abonUsd) || 0));
        if (Array.isArray(c.salesSnapshot)) allSalesCombined = allSalesCombined.concat(c.salesSnapshot);
      });

      const enrAll = enrichTotalsWithEuro(accAll);
      const anAll = buildSalesDetailedAnalytics(allSalesCombined, enrAll.euroRate);
      enrAll.totalUnits = anAll.totalUnits;
      enrAll.costEur = anAll.totalCostEur;
      enrAll.costBs = anAll.totalCostBs;
      enrAll.profitEur = anAll.totalProfitEur;
      enrAll.profitBs = anAll.totalProfitBs;

      return {
        periodType: 'TODOS',
        title: '4. TODOS LOS CIERRES',
        badgeClass: 'mensual',
        periodLabel: selectedDayIso ? `Filtrado por Día: ${selectedDayIso}` : `Todos los Cierres (${targetClosures.length} guardados + Hoy)`,
        opsCount: `${targetClosures.length} cierres • ${fmt(anAll.totalUnits, 0)} unds`,
        daysBreakdown: [],
        productsDetail: anAll.productsDetail,
        salesDetail: anAll.salesDetail,
        clientsDetail,
        totals: enrAll
      };
    }

    if (periodType === 'SEMANAL') {
      const sevenDaysAgoTs = now.getTime() - 7 * 24 * 60 * 60 * 1000;
      const weekClosures = dailyClosures.filter(c => {
        const info = parseClosureDateInfo(c);
        return info.ts >= sevenDaysAgoTs;
      });

      const acc = { usd: 0, puntoBs: 0, pmBs: 0, efBs: 0, divUsd: 0, zelleUsd: 0, pendUsd: 0, abonUsd: 0 };
      const daysBreakdown = [];
      let combinedSales = [];

      if (hasLiveSales) {
        acc.usd = round2(acc.usd + liveTotals.usd);
        acc.puntoBs = round2(acc.puntoBs + liveTotals.puntoBs);
        acc.pmBs = round2(acc.pmBs + liveTotals.pmBs);
        acc.efBs = round2(acc.efBs + liveTotals.efBs);
        acc.divUsd = round2(acc.divUsd + liveTotals.divUsd);
        acc.zelleUsd = round2(acc.zelleUsd + liveTotals.zelleUsd);
        acc.pendUsd = round2(acc.pendUsd + liveTotals.pendUsd);
        acc.abonUsd = round2(acc.abonUsd + liveTotals.abonUsd);

        combinedSales = combinedSales.concat(state.dailySales);
        const liveEnr = enrichTotalsWithEuro(liveTotals);
        const liveAn = buildSalesDetailedAnalytics(state.dailySales, liveEnr.euroRate);
        daysBreakdown.push({
          label: `Hoy — Turno Actual en Vivo (${now.toLocaleDateString('es-VE')})`,
          tipo: 'TURNO ACTUAL',
          units: liveAn.totalUnits,
          eur: liveEnr.eur,
          anchoredBs: liveEnr.anchoredBs,
          costEur: liveAn.totalCostEur,
          costBs: liveAn.totalCostBs,
          profitEur: liveAn.totalProfitEur,
          profitBs: liveAn.totalProfitBs,
          euroRate: liveEnr.euroRate
        });
      }

      weekClosures.forEach(c => {
        acc.usd = round2(acc.usd + (Number(c.totalUsd) || 0));
        acc.puntoBs = round2(acc.puntoBs + (Number(c.puntoBs) || 0));
        acc.pmBs = round2(acc.pmBs + (Number(c.pmBs) || 0));
        acc.efBs = round2(acc.efBs + (Number(c.efBs) || 0));
        acc.divUsd = round2(acc.divUsd + (Number(c.divUsd) || 0));
        acc.zelleUsd = round2(acc.zelleUsd + (Number(c.zelleUsd) || 0));
        acc.pendUsd = round2(acc.pendUsd + (Number(c.pendUsd) || 0));
        acc.abonUsd = round2(acc.abonUsd + (Number(c.abonUsd) || 0));

        if (Array.isArray(c.salesSnapshot) && c.salesSnapshot.length) {
          combinedSales = combinedSales.concat(c.salesSnapshot);
        }

        const cEnr = enrichTotalsWithEuro(
          {
            usd: c.totalUsd,
            puntoBs: c.puntoBs,
            pmBs: c.pmBs,
            efBs: c.efBs,
            divUsd: c.divUsd,
            zelleUsd: c.zelleUsd,
            pendUsd: c.pendUsd,
            abonUsd: c.abonUsd
          },
          c.euroRate,
          c.usdRate
        );
        const cEur = Number(c.totalEur) > 0 ? round2(c.totalEur) : cEnr.eur;
        const cBs = Number(c.totalAnchoredBs) > 0 ? round2(c.totalAnchoredBs) : cEnr.anchoredBs;
        const cCostEur = Number(c.totalCostEur) > 0 ? round2(c.totalCostEur) : round2(cEur * 0.58);
        const cProfEur = Number(c.totalProfitEur) > 0 ? round2(c.totalProfitEur) : round2(cEur - cCostEur);
        daysBreakdown.push({
          label: c.date || 'Cierre Guardado',
          tipo: 'CIERRE DIARIO',
          units: Number(c.totalUnits) || 0,
          eur: cEur,
          anchoredBs: cBs,
          costEur: cCostEur,
          costBs: round2(cCostEur * cEnr.euroRate),
          profitEur: cProfEur,
          profitBs: round2(cProfEur * cEnr.euroRate),
          euroRate: cEnr.euroRate
        });
      });

      const startWeekDate = new Date(sevenDaysAgoTs).toLocaleDateString('es-VE');
      const endWeekDate = now.toLocaleDateString('es-VE');
      const enriched = enrichTotalsWithEuro(acc);
      const analytics = buildSalesDetailedAnalytics(combinedSales, enriched.euroRate);
      enriched.totalUnits = analytics.totalUnits;
      enriched.costEur = analytics.totalCostEur;
      enriched.costBs = analytics.totalCostBs;
      enriched.profitEur = analytics.totalProfitEur;
      enriched.profitBs = analytics.totalProfitBs;
      enriched.marginPct = enriched.eur > 0 ? Math.round((enriched.profitEur / enriched.eur) * 100) : 0;

      return {
        periodType: 'SEMANAL',
        title: '2. CIERRE SEMANAL (7 DÍAS)',
        badgeClass: 'semanal',
        periodLabel: `Semana (${startWeekDate} al ${endWeekDate})`,
        opsCount: `${daysBreakdown.length} jornadas • ${fmt(analytics.totalUnits, 0)} unds`,
        daysBreakdown,
        productsDetail: analytics.productsDetail,
        salesDetail: analytics.salesDetail,
        clientsDetail,
        totals: enriched
      };
    }

    // MENSUAL
    const monthClosures = dailyClosures.filter(c => {
      const info = parseClosureDateInfo(c);
      return info.yearMonth === targetYm;
    });

    const accMonth = { usd: 0, puntoBs: 0, pmBs: 0, efBs: 0, divUsd: 0, zelleUsd: 0, pendUsd: 0, abonUsd: 0 };
    const monthDaysBreakdown = [];
    let combinedMonthSales = [];

    if (targetYm === currentYm && hasLiveSales) {
      accMonth.usd = round2(accMonth.usd + liveTotals.usd);
      accMonth.puntoBs = round2(accMonth.puntoBs + liveTotals.puntoBs);
      accMonth.pmBs = round2(accMonth.pmBs + liveTotals.pmBs);
      accMonth.efBs = round2(accMonth.efBs + liveTotals.efBs);
      accMonth.divUsd = round2(accMonth.divUsd + liveTotals.divUsd);
      accMonth.zelleUsd = round2(accMonth.zelleUsd + liveTotals.zelleUsd);
      accMonth.pendUsd = round2(accMonth.pendUsd + liveTotals.pendUsd);
      accMonth.abonUsd = round2(accMonth.abonUsd + liveTotals.abonUsd);

      combinedMonthSales = combinedMonthSales.concat(state.dailySales);
      const liveEnr = enrichTotalsWithEuro(liveTotals);
      const liveAn = buildSalesDetailedAnalytics(state.dailySales, liveEnr.euroRate);
      monthDaysBreakdown.push({
        label: `Hoy — Turno Actual en Vivo (${todayIso})`,
        tipo: 'TURNO ACTUAL',
        units: liveAn.totalUnits,
        eur: liveEnr.eur,
        anchoredBs: liveEnr.anchoredBs,
        costEur: liveAn.totalCostEur,
        costBs: liveAn.totalCostBs,
        profitEur: liveAn.totalProfitEur,
        profitBs: liveAn.totalProfitBs,
        euroRate: liveEnr.euroRate
      });
    }

    monthClosures.forEach(c => {
      accMonth.usd = round2(accMonth.usd + (Number(c.totalUsd) || 0));
      accMonth.puntoBs = round2(accMonth.puntoBs + (Number(c.puntoBs) || 0));
      accMonth.pmBs = round2(accMonth.pmBs + (Number(c.pmBs) || 0));
      accMonth.efBs = round2(accMonth.efBs + (Number(c.efBs) || 0));
      accMonth.divUsd = round2(accMonth.divUsd + (Number(c.divUsd) || 0));
      accMonth.zelleUsd = round2(accMonth.zelleUsd + (Number(c.zelleUsd) || 0));
      accMonth.pendUsd = round2(accMonth.pendUsd + (Number(c.pendUsd) || 0));
      accMonth.abonUsd = round2(accMonth.abonUsd + (Number(c.abonUsd) || 0));

      if (Array.isArray(c.salesSnapshot) && c.salesSnapshot.length) {
        combinedMonthSales = combinedMonthSales.concat(c.salesSnapshot);
      }

      const cEnr = enrichTotalsWithEuro(
        {
          usd: c.totalUsd,
          puntoBs: c.puntoBs,
          pmBs: c.pmBs,
          efBs: c.efBs,
          divUsd: c.divUsd,
          zelleUsd: c.zelleUsd,
          pendUsd: c.pendUsd,
          abonUsd: c.abonUsd
        },
        c.euroRate,
        c.usdRate
      );
      const cEur = Number(c.totalEur) > 0 ? round2(c.totalEur) : cEnr.eur;
      const cBs = Number(c.totalAnchoredBs) > 0 ? round2(c.totalAnchoredBs) : cEnr.anchoredBs;
      const cCostEur = Number(c.totalCostEur) > 0 ? round2(c.totalCostEur) : round2(cEur * 0.58);
      const cProfEur = Number(c.totalProfitEur) > 0 ? round2(c.totalProfitEur) : round2(cEur - cCostEur);
      monthDaysBreakdown.push({
        label: c.date || 'Cierre Guardado',
        tipo: 'CIERRE DIARIO',
        units: Number(c.totalUnits) || 0,
        eur: cEur,
        anchoredBs: cBs,
        costEur: cCostEur,
        costBs: round2(cCostEur * cEnr.euroRate),
        profitEur: cProfEur,
        profitBs: round2(cProfEur * cEnr.euroRate),
        euroRate: cEnr.euroRate
      });
    });

    const enrichedMonth = enrichTotalsWithEuro(accMonth);
    const monthAnalytics = buildSalesDetailedAnalytics(combinedMonthSales, enrichedMonth.euroRate);
    enrichedMonth.totalUnits = monthAnalytics.totalUnits;
    enrichedMonth.costEur = monthAnalytics.totalCostEur;
    enrichedMonth.costBs = monthAnalytics.totalCostBs;
    enrichedMonth.profitEur = monthAnalytics.totalProfitEur;
    enrichedMonth.profitBs = monthAnalytics.totalProfitBs;
    enrichedMonth.marginPct = enrichedMonth.eur > 0 ? Math.round((enrichedMonth.profitEur / enrichedMonth.eur) * 100) : 0;

    return {
      periodType: 'MENSUAL',
      title: '3. CIERRE MENSUAL (MES)',
      badgeClass: 'mensual',
      periodLabel: formatMonthLabel(targetYm),
      opsCount: `${monthDaysBreakdown.length} jornadas • ${fmt(monthAnalytics.totalUnits, 0)} unds`,
      daysBreakdown: monthDaysBreakdown,
      productsDetail: monthAnalytics.productsDetail,
      salesDetail: monthAnalytics.salesDetail,
      clientsDetail,
      totals: enrichedMonth
    };
  }

  // Construye las 3 tarjetas grandes y sencillas para Cierre Diario, Semanal y Mensual
  function buildSimpleClosureCardsHtml(periods, highlightActive = false) {
    return periods
      .map(p => {
        const t = p.totals;
        const divBs = round2(t.totalDivInEur * t.euroRate);
        const pendBs = round2(t.pendEur * t.euroRate);
        const isSelected = highlightActive && p.periodType === activeClosurePeriod;
        return `
        <div class="simple-closure-card ${isSelected ? 'active-card' : ''}">
          <div>
            <div class="scc-header">
              <span class="scc-title">${esc(p.title)}</span>
              <span class="euro-badge-pill ${p.badgeClass}">${fmt(t.totalUnits || 0, 0)} unds</span>
            </div>
            <div class="scc-period">${esc(p.periodLabel)}</div>
          </div>

          <div class="scc-main-amount">
            <span>TOTAL VENDIDO EN BOLÍVARES (Tasa Euro)</span>
            <strong>${fmt(t.anchoredBs, 2)} Bs</strong>
            <small>Equivalente: €${fmt(t.eur, 2)}</small>
          </div>

          <div class="scc-lines">
            <div class="scc-line">
              <span>Punto + Pago Móvil + Efectivo:</span>
              <strong>${fmt(t.totalBs, 2)} Bs</strong>
            </div>
            <div class="scc-line">
              <span>Divisas + Zelle:</span>
              <strong>€${fmt(t.totalDivInEur, 2)} (${fmt(divBs, 2)} Bs)</strong>
            </div>
            <div class="scc-line">
              <span>Por Cobrar (Fiado):</span>
              <strong class="text-yellow">${fmt(pendBs, 2)} Bs (€${fmt(t.pendEur, 2)})</strong>
            </div>
            <div class="scc-line" style="background:rgba(16,185,129,0.14); border:1px solid rgba(16,185,129,0.4);">
              <span>Ganancia Libre:</span>
              <strong class="text-green">${fmt(t.profitBs || 0, 2)} Bs (€${fmt(t.profitEur || 0, 2)})</strong>
            </div>
          </div>

          <div class="scc-actions">
            <button type="button" class="btn-gold btn-quick-save-closure" data-period="${p.periodType}">
              <i class="fa-solid fa-check-double"></i> GUARDAR CIERRE
            </button>
            <button type="button" class="btn-outline btn-quick-print-closure" data-period="${p.periodType}">
              <i class="fa-solid fa-print"></i> IMPRIMIR PDF
            </button>
          </div>
        </div>
      `;
      })
      .join('');
  }

  // Renderiza el Renglón Sencillo de Cierres Diario, Semanal y Mensual dentro de 1. Caja Diaria
  function renderCajaEuroRenglon() {
    const container = document.getElementById('caja-euro-renglon-tbody');
    const rateLbl = document.getElementById('caja-euro-rate-lbl');
    if (rateLbl) rateLbl.textContent = `${fmt(getEuroRate(), 2)} Bs/€`;
    if (!container) return;

    const periods = [
      getClosurePeriodSummary('DIARIO'),
      getClosurePeriodSummary('SEMANAL'),
      getClosurePeriodSummary('MENSUAL')
    ];

    container.innerHTML = buildSimpleClosureCardsHtml(periods, false);

    container.querySelectorAll('.btn-quick-save-closure').forEach(btn => {
      btn.addEventListener('click', () => {
        const per = btn.getAttribute('data-period');
        saveClosureByPeriod(per, `Cierre ${per} guardado (Tasa Euro BCV: ${fmt(getEuroRate(), 2)} Bs/€)`);
      });
    });

    container.querySelectorAll('.btn-quick-print-closure').forEach(btn => {
      btn.addEventListener('click', () => {
        const per = btn.getAttribute('data-period');
        openPrintableReport(`EURO_CLOSURE_${per}`);
      });
    });
  }

  function saveClosureByPeriod(periodType = 'DIARIO', customNote = '') {
    const summary = getClosurePeriodSummary(periodType);
    const t = summary.totals;
    const newClosure = {
      id: `cl-${Date.now()}`,
      tipo: periodType,
      timestamp: Date.now(),
      isoDate: new Date().toISOString().slice(0, 10),
      yearMonth: new Date().toISOString().slice(0, 7),
      date: new Date().toLocaleString('es-VE'),
      periodLabel: summary.periodLabel,
      cashier: currentUser ? currentUser.fullName : 'dzara',
      euroRate: t.euroRate,
      usdRate: t.usdRate,
      totalUnits: t.totalUnits || 0,
      totalEur: t.eur,
      totalAnchoredBs: t.anchoredBs,
      totalCostEur: t.costEur || 0,
      totalCostBs: t.costBs || 0,
      totalProfitEur: t.profitEur || 0,
      totalProfitBs: t.profitBs || 0,
      totalUsd: t.usd,
      puntoBs: t.puntoBs,
      pmBs: t.pmBs,
      efBs: t.efBs,
      divUsd: t.divUsd,
      zelleUsd: t.zelleUsd,
      pendUsd: t.pendUsd,
      abonUsd: t.abonUsd,
      salesSnapshot: periodType === 'DIARIO' ? JSON.parse(JSON.stringify(state.dailySales || [])) : [],
      nota: customNote
    };

    state.closures.unshift(newClosure);
    saveState();
    renderCajaEuroRenglon();
    renderCierreView();
    toast(`¡Cierre ${periodType} guardado! Venta: ${fmt(t.anchoredBs, 2)} Bs (€${fmt(t.eur, 2)}) • Ganancia: ${fmt(t.profitBs, 2)} Bs`);
  }

  function exportClosuresToExcel() {
    const summaries = [
      getClosurePeriodSummary('DIARIO'),
      getClosurePeriodSummary('SEMANAL'),
      getClosurePeriodSummary('MENSUAL')
    ];
    const headers = [
      'RENGLON DE CIERRE',
      'PERIODO / FECHA',
      'TASA EURO BCV (Bs/€)',
      'TASA DOLAR BCV (Bs/$)',
      'TOTAL ANCLADO EUROS (€)',
      'TOTAL BOLIVARES ANCLADO (Bs)',
      'TOTAL DOLARES ($)',
      'PUNTO (Bs)',
      'PUNTO (€)',
      'PAGO MOVIL (Bs)',
      'PAGO MOVIL (€)',
      'EFECTIVO (Bs)',
      'EFECTIVO (€)',
      'DIVISAS ($)',
      'ZELLE ($)',
      'FIADO PENDIENTE (€)',
      'ABONOS COBRADOS (€)'
    ];
    const summaryRows = summaries.map(s => {
      const t = s.totals;
      return [
        s.title,
        s.periodLabel,
        t.euroRate,
        t.usdRate,
        t.eur,
        t.anchoredBs,
        t.usd,
        t.puntoBs,
        t.puntoEur,
        t.pmBs,
        t.pmEur,
        t.efBs,
        t.efEur,
        t.divUsd,
        t.zelleUsd,
        t.pendEur,
        t.abonEur
      ];
    });

    const historyRows = (state.closures || []).map(c => {
      const enr = enrichTotalsWithEuro(
        {
          usd: c.totalUsd,
          puntoBs: c.puntoBs,
          pmBs: c.pmBs,
          efBs: c.efBs,
          divUsd: c.divUsd,
          zelleUsd: c.zelleUsd,
          pendUsd: c.pendUsd,
          abonUsd: c.abonUsd
        },
        c.euroRate,
        c.usdRate
      );
      return [
        `HISTORIAL: CIERRE ${c.tipo || 'DIARIO'}`,
        `${c.date} (${c.periodLabel || ''})`,
        enr.euroRate,
        enr.usdRate,
        c.totalEur || enr.eur,
        c.totalAnchoredBs || enr.anchoredBs,
        c.totalUsd,
        c.puntoBs,
        enr.puntoEur,
        c.pmBs,
        enr.pmEur,
        c.efBs,
        enr.efEur,
        c.divUsd,
        c.zelleUsd,
        enr.pendEur,
        enr.abonEur
      ];
    });

    const csv = '\uFEFF' + [headers, ...summaryRows, ...historyRows].map(r => r.map(v => `"${v ?? ''}"`).join(';')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    a.download = `Cierres_Diario_Semanal_Mensual_Euro_Atoz.csv`;
    a.click();
  }

  function renderCierreView() {
    const euroRate = getEuroRate();
    const usdRate = getUsdRate();
    const ratio = usdRate > 0 ? round2(euroRate / usdRate) : 1.08;

    const eurDisp = document.getElementById('cierre-euro-rate-display');
    const usdDisp = document.getElementById('cierre-usd-rate-display');
    const ratioDisp = document.getElementById('cierre-eur-usd-ratio');
    const modeSel = document.getElementById('cierre-euro-mode-select');
    const modeHint = document.getElementById('cierre-euro-mode-hint');

    if (eurDisp) eurDisp.textContent = `${fmt(euroRate, 2)} Bs/€`;
    if (usdDisp) usdDisp.textContent = `BOLÍVARES (Bs) ↔ EURO (€)`;
    if (ratioDisp) ratioDisp.textContent = `1 € = ${fmt(euroRate, 2)} Bs (Tasa Oficial BCV)`;
    if (modeSel) modeSel.value = state.euroAnchorMode || 'PARITY_1_1';
    if (modeHint) {
      modeHint.textContent = 'Todo el sistema opera en Bolívares (Bs) anclado a la Tasa Oficial del Euro BCV';
    }

    // 1. Renderizar Tabla Maestra con los 3 Renglones (Diario, Semanal y Mensual)
    const masterTbody = document.getElementById('cierre-master-renglones-tbody');
    const allPeriods = [
      getClosurePeriodSummary('DIARIO'),
      getClosurePeriodSummary('SEMANAL'),
      getClosurePeriodSummary('MENSUAL')
    ];

    if (masterTbody) {
      masterTbody.innerHTML = buildSimpleClosureCardsHtml(allPeriods, true);

      masterTbody.querySelectorAll('.btn-quick-save-closure').forEach(btn => {
        btn.addEventListener('click', () => {
          const per = btn.getAttribute('data-period') || 'DIARIO';
          saveClosureByPeriod(per, document.getElementById('cierre-nota')?.value.trim() || `Cierre ${per} guardado`);
        });
      });

      masterTbody.querySelectorAll('.btn-quick-print-closure').forEach(btn => {
        btn.addEventListener('click', () => {
          const per = btn.getAttribute('data-period') || 'DIARIO';
          openPrintableReport(`EURO_CLOSURE_${per}`);
        });
      });
    }

    // 2. Renderizar Detalle Claro del Período Activo (DIARIO | SEMANAL | MENSUAL | TODOS)
    const activeSummary =
      activeClosurePeriod === 'TODOS'
        ? getClosurePeriodSummary('TODOS')
        : allPeriods.find(x => x.periodType === activeClosurePeriod) || allPeriods[0];
    const t = activeSummary.totals;

    const titleMap = {
      DIARIO: `1. Cierre Diario (${activeSummary.periodLabel})`,
      SEMANAL: '2. Cierre Semanal (7 Días)',
      MENSUAL: `3. Cierre Mensual (${activeSummary.periodLabel})`,
      TODOS: `4. Todos los Cierres (${activeSummary.periodLabel})`
    };
    const titleEl = document.getElementById('cierre-active-period-title');
    if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-cash-register text-gold"></i> ${esc(titleMap[activeClosurePeriod])}`;
    const subEl = document.getElementById('cierre-active-period-subtitle');
    if (subEl) subEl.textContent = `${activeSummary.periodLabel} • ${activeSummary.opsCount} • Tasa Euro BCV: ${fmt(euroRate, 2)} Bs/€`;

    const saveBtn = document.getElementById('btn-save-active-closure');
    if (saveBtn) {
      saveBtn.innerHTML = `<i class="fa-solid fa-check-double"></i> GUARDAR CIERRE ${activeClosurePeriod} (${fmt(t.anchoredBs, 2)} Bs)`;
    }

    const eurEl = document.getElementById('cierre-total-eur');
    if (eurEl) eurEl.textContent = `€${fmt(t.eur, 2)}`;
    const eurSub = document.getElementById('cierre-total-eur-sub');
    if (eurSub) eurSub.textContent = `Ganancia Libre: ${fmt(t.profitBs || 0, 2)} Bs (€${fmt(t.profitEur || 0, 2)})`;

    document.getElementById('cierre-total-usd').textContent = `${fmt(t.anchoredBs, 2)} Bs`;
    const opsSub = document.getElementById('cierre-ops-count-sub');
    if (opsSub) opsSub.textContent = `${activeSummary.opsCount}`;

    document.getElementById('cierre-total-bs').textContent = `${fmt(t.totalBs, 2)} Bs`;
    const bsEurSub = document.getElementById('cierre-total-bs-in-eur');
    if (bsEurSub) bsEurSub.textContent = `Equivalente: €${fmt(t.totalBsInEur, 2)}`;

    const totalDivBs = round2(t.totalDivInEur * euroRate);
    document.getElementById('cierre-total-divisas').textContent = `${fmt(totalDivBs, 2)} Bs`;
    const divEurSub = document.getElementById('cierre-total-div-in-eur');
    if (divEurSub) divEurSub.textContent = `Equivalente: €${fmt(t.totalDivInEur, 2)}`;

    document.getElementById('cierre-line-punto').textContent = `${fmt(t.puntoBs, 2)} Bs (€${fmt(t.puntoEur, 2)})`;
    document.getElementById('cierre-line-pm').textContent = `${fmt(t.pmBs, 2)} Bs (€${fmt(t.pmEur, 2)})`;
    document.getElementById('cierre-line-efbs').textContent = `${fmt(t.efBs, 2)} Bs (€${fmt(t.efEur, 2)})`;
    document.getElementById('cierre-line-divisas').textContent = `${fmt(round2(t.divEur * euroRate), 2)} Bs (€${fmt(t.divEur, 2)})`;
    document.getElementById('cierre-line-zelle').textContent = `${fmt(round2(t.zelleEur * euroRate), 2)} Bs (€${fmt(t.zelleEur, 2)})`;
    document.getElementById('cierre-line-pendiente').textContent = `${fmt(round2(t.pendEur * euroRate), 2)} Bs (€${fmt(t.pendEur, 2)})`;
    document.getElementById('cierre-line-abonado').textContent = `${fmt(round2(t.abonEur * euroRate), 2)} Bs (€${fmt(t.abonEur, 2)})`;

    const unidsEl = document.getElementById('cierre-line-unidades');
    if (unidsEl) unidsEl.textContent = `${fmt(t.totalUnits || 0, 0)} unidades`;
    const costoEl = document.getElementById('cierre-line-costo');
    if (costoEl) costoEl.textContent = `${fmt(t.costBs || 0, 2)} Bs (€${fmt(t.costEur || 0, 2)})`;
    const ganEl = document.getElementById('cierre-line-ganancia');
    if (ganEl) ganEl.textContent = `${fmt(t.profitBs || 0, 2)} Bs (€${fmt(t.profitEur || 0, 2)})`;

    // Tabla Sencilla de Productos Vendidos en este Cierre (5 columnas grandes y claras)
    const prodTbody = document.getElementById('cierre-products-detail-tbody');
    const prodTfoot = document.getElementById('cierre-products-detail-tfoot');
    if (prodTbody) {
      const prods = activeSummary.productsDetail || [];
      prodTbody.innerHTML = prods.length
        ? prods
            .map(
              p => `
            <tr>
              <td style="text-align:left;"><strong>${esc(p.product)}</strong></td>
              <td><strong>${fmt(p.qty, 0)}</strong></td>
              <td><strong class="text-gold">${fmt(p.totalBs, 2)} Bs</strong></td>
              <td><strong style="color:#93C5FD;">€${fmt(p.totalEur, 2)}</strong></td>
              <td><strong class="text-green">${fmt(p.profitBs, 2)} Bs (€${fmt(p.profitEur, 2)})</strong></td>
            </tr>
          `
            )
            .join('')
        : `<tr><td colspan="5" class="hint">No hay productos vendidos registrados en este período.</td></tr>`;

      if (prodTfoot) {
        prodTfoot.innerHTML = prods.length
          ? `
          <tr>
            <td style="text-align:left;">TOTAL GENERAL</td>
            <td>${fmt(t.totalUnits || 0, 0)} unds</td>
            <td>${fmt(t.anchoredBs, 2)} Bs</td>
            <td>€${fmt(t.eur, 2)}</td>
            <td>${fmt(t.profitBs || 0, 2)} Bs (€${fmt(t.profitEur || 0, 2)})</td>
          </tr>
        `
          : '';
      }
    }

    // 3. Historial de Cierres Guardados (Filtrable por Tipo y por Día)
    const clList = document.getElementById('closures-list');
    const filterType = document.getElementById('filter-closures-type')?.value || 'ALL';
    const filterDay = (document.getElementById('filter-closures-day')?.value || document.getElementById('cierre-day-picker')?.value || '').trim();
    const filteredClosures = (state.closures || []).filter(c => {
      const cType = c.tipo || 'DIARIO';
      if (filterType !== 'ALL' && cType !== filterType) return false;
      if (filterDay) {
        const info = parseClosureDateInfo(c);
        if (info.isoDate !== filterDay) return false;
      }
      return true;
    });

    const countBadge = document.getElementById('closures-count-badge');
    if (countBadge) countBadge.textContent = `${filteredClosures.length} cierres`;

    if (!filteredClosures.length) {
      clList.innerHTML = `<p class="hint" style="font-size:14.5px;">No hay cierres guardados para este filtro. Toca <strong>GUARDAR CIERRE</strong> para registrar uno o toca <strong>Ver Todos</strong>.</p>`;
      return;
    }

    clList.innerHTML = filteredClosures
      .map(c => {
        const cType = c.tipo || 'DIARIO';
        const badgeCls = cType === 'SEMANAL' ? 'semanal' : cType === 'MENSUAL' ? 'mensual' : '';
        const enr = enrichTotalsWithEuro(
          {
            usd: c.totalUsd,
            puntoBs: c.puntoBs,
            pmBs: c.pmBs,
            efBs: c.efBs,
            divUsd: c.divUsd,
            zelleUsd: c.zelleUsd,
            pendUsd: c.pendUsd,
            abonUsd: c.abonUsd
          },
          c.euroRate,
          c.usdRate
        );
        const eurVal = Number(c.totalEur) > 0 ? round2(c.totalEur) : enr.eur;
        const bsVal = Number(c.totalAnchoredBs) > 0 ? round2(c.totalAnchoredBs) : enr.anchoredBs;
        return `
      <div class="closure-item">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px; margin-bottom:6px;">
          <div>
            <span class="euro-badge-pill ${badgeCls}">CIERRE ${esc(cType)}</span>
            <strong class="text-gold" style="margin-left:6px;">${esc(c.date)}</strong>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <strong style="color:#93C5FD; font-size:15px;">€${fmt(eurVal, 2)}</strong>
            <strong>($${fmt(c.totalUsd, 2)} / ${fmt(bsVal, 2)} Bs)</strong>
            <button type="button" class="mini-btn btn-print-saved-closure" data-id="${c.id}" title="Imprimir este cierre en PDF">
              <i class="fa-solid fa-print"></i>
            </button>
            <button type="button" class="mini-btn btn-del-saved-closure" data-id="${c.id}" title="Eliminar cierre del historial">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>
        <div style="font-size:12.5px; color:var(--muted);">
          ${c.periodLabel ? `Período: <strong>${esc(c.periodLabel)}</strong> • ` : ''}Cajero: ${esc(c.cashier)} • Tasa € BCV: ${fmt(enr.euroRate, 2)} Bs/€ • Punto: ${fmt(c.puntoBs, 2)} Bs • PM: ${fmt(c.pmBs, 2)} Bs • Divisas: $${fmt(c.divUsd, 2)}
        </div>
        ${c.nota ? `<div style="font-size:12.5px; margin-top:4px; color:var(--gold);">Nota: ${esc(c.nota)}</div>` : ''}
      </div>
    `;
      })
      .join('');

    clList.querySelectorAll('.btn-print-saved-closure').forEach(btn => {
      btn.addEventListener('click', () => {
        const found = state.closures.find(x => x.id === btn.getAttribute('data-id'));
        if (found) openPrintableReport('SINGLE_SAVED_CLOSURE', found);
      });
    });

    clList.querySelectorAll('.btn-del-saved-closure').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        state.closures = state.closures.filter(x => x.id !== id);
        saveState();
        renderCierreView();
        renderCajaEuroRenglon();
        toast('Cierre eliminado del historial');
      });
    });
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

    document.getElementById('cli-sum-deuda').textContent = `${fmt(round2(sumDeuda * rate), 2)} Bs (€${fmt(sumDeuda, 2)})`;
    document.getElementById('cli-sum-favor').textContent = `${fmt(round2(sumFavor * rate), 2)} Bs (€${fmt(sumFavor, 2)})`;
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
        const favorUsd = round2(Number(c.aFavor) || 0);
        const favorBs = round2(favorUsd * rate);
        const itemsText =
          deudaUsd > 0 && Array.isArray(c.itemsPendientes) && c.itemsPendientes.length
            ? c.itemsPendientes.map(it => `${it.qty || 1}x ${it.product} (${fmt(round2((Number(it.totalUsd) || 0) * rate), 2)} Bs / €${fmt(it.totalUsd, 2)})`).join(' • ')
            : deudaUsd > 0
            ? 'Saldo pendiente en cuenta'
            : 'Al día (Sin deuda)';

        return `
      <tr>
        <td style="text-align:left;"><strong>${esc(c.name)}</strong></td>
        <td>${deudaUsd > 0 ? `<strong class="text-gold">${fmt(deudaBs, 2)} Bs</strong>` : '0,00 Bs'}</td>
        <td>${deudaUsd > 0 ? `<strong class="text-yellow">€${fmt(deudaUsd, 2)}</strong>` : '€0,00'}</td>
        <td style="text-align:left; max-width:340px; overflow:hidden; text-overflow:ellipsis;" title="${esc(itemsText)}">
          <span style="font-size:12.5px; color:${deudaUsd > 0 ? '#FFF' : 'var(--muted)'};">${esc(itemsText)}</span>
        </td>
        <td>${favorUsd > 0 ? `<strong class="text-green">${fmt(favorBs, 2)} Bs (€${fmt(favorUsd, 2)})</strong>` : '0,00 Bs'}</td>
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
    } else if (type === 'EURO_CLOSURE_ALL' || type === 'EURO_CLOSURE_DIARIO' || type === 'EURO_CLOSURE_SEMANAL' || type === 'EURO_CLOSURE_MENSUAL') {
      const euroRate = getEuroRate();
      const targetPeriods =
        type === 'EURO_CLOSURE_ALL'
          ? [getClosurePeriodSummary('DIARIO'), getClosurePeriodSummary('SEMANAL'), getClosurePeriodSummary('MENSUAL')]
          : [getClosurePeriodSummary(type.replace('EURO_CLOSURE_', ''))];

      const mainS = targetPeriods[0];
      const mt = mainS.totals;
      reportTitle =
        type === 'EURO_CLOSURE_ALL'
          ? 'REPORTE EJECUTIVO DE CIERRES DIARIO, SEMANAL Y MENSUAL — EN BOLÍVARES ANCLADO AL EURO (€ BCV)'
          : `REPORTE DETALLADO DE ${mainS.title} — EN BOLÍVARES ANCLADO AL EURO (€ BCV)`;

      summaryBoxesHtml = `
        <div class="kpi-row">
          <div class="kpi"><span>TASA EURO BCV OFICIAL</span><strong>${fmt(euroRate, 2)} Bs/€</strong></div>
          <div class="kpi"><span>UNIDADES VENDIDAS</span><strong>${fmt(mt.totalUnits || 0, 0)} Unds</strong></div>
          <div class="kpi"><span>FACTURACIÓN TOTAL (Bs)</span><strong>${fmt(mt.anchoredBs, 2)} Bs</strong></div>
          <div class="kpi"><span>TOTAL ANCLADO (€ BCV)</span><strong>€${fmt(mt.eur, 2)}</strong></div>
          <div class="kpi"><span>COSTO MERCANCÍA (Bs / €)</span><strong>${fmt(mt.costBs || 0, 2)} Bs (€${fmt(mt.costEur || 0, 2)})</strong></div>
          <div class="kpi"><span>GANANCIA NETA (Bs / €)</span><strong>${fmt(mt.profitBs || 0, 2)} Bs (€${fmt(mt.profitEur || 0, 2)})</strong></div>
        </div>
      `;

      tableHtml = `
        <h3 style="color:#5B141E; margin: 10px 0 6px;">1. Resumen General de Cierre por Método de Pago, Costos y Ganancias (Bs y € BCV)</h3>
        <table>
          <thead>
            <tr>
              <th style="text-align:left;">RENGLÓN DE CIERRE</th>
              <th style="text-align:left;">PERÍODO</th>
              <th>UNDS</th>
              <th>VENTA TOTAL (Bs)</th>
              <th>TOTAL (€ BCV)</th>
              <th>COSTO (Bs / €)</th>
              <th>GANANCIA NETA (Bs / €)</th>
              <th>PUNTO (Bs / €)</th>
              <th>PAGO MÓVIL (Bs / €)</th>
              <th>EFECTIVO (Bs / €)</th>
              <th>DIVISAS + ZELLE (Bs / €)</th>
              <th>FIADOS / ABONOS (€)</th>
            </tr>
          </thead>
          <tbody>
            ${targetPeriods
              .map(p => {
                const pt = p.totals;
                const divBs = round2(pt.totalDivInEur * pt.euroRate);
                return `
              <tr>
                <td style="text-align:left;"><strong>${esc(p.title)}</strong></td>
                <td style="text-align:left;">${esc(p.periodLabel)}</td>
                <td><strong>${fmt(pt.totalUnits || 0, 0)}</strong></td>
                <td><strong>${fmt(pt.anchoredBs, 2)} Bs</strong></td>
                <td><strong>€${fmt(pt.eur, 2)}</strong></td>
                <td>${fmt(pt.costBs || 0, 2)} Bs (€${fmt(pt.costEur || 0, 2)})</td>
                <td><strong>${fmt(pt.profitBs || 0, 2)} Bs (€${fmt(pt.profitEur || 0, 2)})</strong></td>
                <td>${fmt(pt.puntoBs, 2)} Bs (€${fmt(pt.puntoEur, 2)})</td>
                <td>${fmt(pt.pmBs, 2)} Bs (€${fmt(pt.pmEur, 2)})</td>
                <td>${fmt(pt.efBs, 2)} Bs (€${fmt(pt.efEur, 2)})</td>
                <td>${fmt(divBs, 2)} Bs (€${fmt(pt.totalDivInEur, 2)})</td>
                <td>€${fmt(pt.pendEur, 2)} / €${fmt(pt.abonEur, 2)}</td>
              </tr>
            `;
              })
              .join('')}
          </tbody>
        </table>
      `;

      if (mainS.productsDetail && mainS.productsDetail.length > 0) {
        tableHtml += `
          <h3 style="color:#5B141E; margin: 16px 0 6px;">2. Detalle de Todos los Productos Vendidos, Costos y Ganancia Neta (${esc(mainS.periodLabel)})</h3>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th style="text-align:left;">PRODUCTO VENDIDO</th>
                <th>CATEGORÍA</th>
                <th>CANT</th>
                <th>PRECIO UNIT (Bs / €)</th>
                <th>TOTAL VENTA (Bs / €)</th>
                <th>COSTO TOTAL (Bs / €)</th>
                <th>GANANCIA NETA (Bs / €)</th>
              </tr>
            </thead>
            <tbody>
              ${mainS.productsDetail
                .map(
                  (p, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td style="text-align:left;"><strong>${esc(p.product)}</strong></td>
                  <td>${esc(p.category)}</td>
                  <td><strong>${fmt(p.qty, 0)}</strong></td>
                  <td>${fmt(p.unitPriceBs, 2)} Bs (€${fmt(p.unitPriceEur, 2)})</td>
                  <td><strong>${fmt(p.totalBs, 2)} Bs (€${fmt(p.totalEur, 2)})</strong></td>
                  <td>${fmt(p.costBs, 2)} Bs (€${fmt(p.costEur, 2)})</td>
                  <td><strong>${fmt(p.profitBs, 2)} Bs (€${fmt(p.profitEur, 2)})</strong></td>
                </tr>
              `
                )
                .join('')}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3" style="text-align:left;">TOTALES DE PRODUCTOS VENDIDOS</td>
                <td>${fmt(mt.totalUnits || 0, 0)} unds</td>
                <td>—</td>
                <td>${fmt(mt.anchoredBs, 2)} Bs (€${fmt(mt.eur, 2)})</td>
                <td>${fmt(mt.costBs || 0, 2)} Bs (€${fmt(mt.costEur || 0, 2)})</td>
                <td>${fmt(mt.profitBs || 0, 2)} Bs (€${fmt(mt.profitEur || 0, 2)})</td>
              </tr>
            </tfoot>
          </table>
        `;
      }

      if (mainS.salesDetail && mainS.salesDetail.length > 0) {
        tableHtml += `
          <h3 style="color:#5B141E; margin: 16px 0 6px;">3. Detalle Línea por Línea de Ventas y Operaciones (${esc(mainS.periodLabel)})</h3>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th style="text-align:left;">FECHA / HORA</th>
                <th style="text-align:left;">PRODUCTO / CONCEPTO</th>
                <th>CANT</th>
                <th>TOTAL (Bs)</th>
                <th>TOTAL (€)</th>
                <th>MÉTODO DE PAGO</th>
                <th style="text-align:left;">CLIENTE</th>
                <th>ESTADO</th>
              </tr>
            </thead>
            <tbody>
              ${mainS.salesDetail
                .map(
                  (s, idx) => `
                <tr class="${s.isPending ? 'hl' : ''}">
                  <td>${idx + 1}</td>
                  <td style="text-align:left;">${esc(s.date)}</td>
                  <td style="text-align:left;"><strong>${esc(s.product)}</strong></td>
                  <td>${fmt(s.qty, 0)}</td>
                  <td><strong>${fmt(s.totalBs, 2)} Bs</strong></td>
                  <td><strong>€${fmt(s.totalEur, 2)}</strong></td>
                  <td>${esc(s.methodLabel)}</td>
                  <td style="text-align:left;">${esc(s.client)}</td>
                  <td>${s.isPending ? 'PENDIENTE' : s.isAbono ? 'ABONO' : 'PAGADO'}</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        `;
      }

      if (mainS.daysBreakdown && mainS.daysBreakdown.length > 0) {
        tableHtml += `
          <h3 style="color:#5B141E; margin: 16px 0 6px;">4. Desglose de Jornadas / Días Incluidos (${esc(mainS.periodLabel)})</h3>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th style="text-align:left;">FECHA / JORNADA</th>
                <th>TIPO</th>
                <th>UNDS</th>
                <th>VENTA TOTAL (Bs)</th>
                <th>TOTAL (€ BCV)</th>
                <th>COSTO (Bs / €)</th>
                <th>GANANCIA NETA (Bs / €)</th>
                <th>TASA € BCV</th>
              </tr>
            </thead>
            <tbody>
              ${mainS.daysBreakdown
                .map(
                  (d, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td style="text-align:left;"><strong>${esc(d.label)}</strong></td>
                  <td>${esc(d.tipo)}</td>
                  <td>${fmt(d.units || 0, 0)}</td>
                  <td><strong>${fmt(d.anchoredBs || 0, 2)} Bs</strong></td>
                  <td><strong>€${fmt(d.eur, 2)}</strong></td>
                  <td>${fmt(d.costBs || 0, 2)} Bs (€${fmt(d.costEur || 0, 2)})</td>
                  <td><strong>${fmt(d.profitBs || 0, 2)} Bs (€${fmt(d.profitEur || 0, 2)})</strong></td>
                  <td>${fmt(d.euroRate, 2)} Bs/€</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        `;
      }
    } else if (type === 'SINGLE_SAVED_CLOSURE' && optionalClient) {
      const c = optionalClient;
      const enr = enrichTotalsWithEuro(
        {
          usd: c.totalUsd,
          puntoBs: c.puntoBs,
          pmBs: c.pmBs,
          efBs: c.efBs,
          divUsd: c.divUsd,
          zelleUsd: c.zelleUsd,
          pendUsd: c.pendUsd,
          abonUsd: c.abonUsd
        },
        c.euroRate,
        c.usdRate
      );
      const eurVal = Number(c.totalEur) > 0 ? round2(c.totalEur) : enr.eur;
      reportTitle = `COMPROBANTE DE CIERRE ${c.tipo || 'DIARIO'} ANCLADO AL EURO (€ BCV)`;
      summaryBoxesHtml = `
        <div class="kpi-row">
          <div class="kpi"><span>FECHA / PERÍODO</span><strong>${esc(c.periodLabel || c.date)}</strong></div>
          <div class="kpi"><span>TOTAL ANCLADO EN EUROS</span><strong>€${fmt(eurVal, 2)}</strong></div>
          <div class="kpi"><span>TASA EURO BCV</span><strong>${fmt(enr.euroRate, 2)} Bs/€</strong></div>
          <div class="kpi"><span>TOTAL EN BOLÍVARES</span><strong>${fmt(enr.anchoredBs, 2)} Bs</strong></div>
          <div class="kpi"><span>TOTAL EN DÓLARES</span><strong>$${fmt(c.totalUsd, 2)}</strong></div>
        </div>
      `;
      tableHtml = `
        <table>
          <thead>
            <tr>
              <th style="text-align:left;">MÉTODO DE PAGO / RENGLÓN</th>
              <th>MONTO ORIGINAL</th>
              <th>EQUIVALENTE EN EUROS (€ BCV)</th>
            </tr>
          </thead>
          <tbody>
            <tr><td style="text-align:left;"><strong>Punto de Venta (Bs)</strong></td><td>${fmt(c.puntoBs, 2)} Bs</td><td><strong>€${fmt(enr.puntoEur, 2)}</strong></td></tr>
            <tr><td style="text-align:left;"><strong>Pago Móvil (Bs)</strong></td><td>${fmt(c.pmBs, 2)} Bs</td><td><strong>€${fmt(enr.pmEur, 2)}</strong></td></tr>
            <tr><td style="text-align:left;"><strong>Efectivo Bolívares (Bs)</strong></td><td>${fmt(c.efBs, 2)} Bs</td><td><strong>€${fmt(enr.efEur, 2)}</strong></td></tr>
            <tr><td style="text-align:left;"><strong>Divisas en Efectivo ($)</strong></td><td>$${fmt(c.divUsd, 2)}</td><td><strong>€${fmt(enr.divEur, 2)}</strong></td></tr>
            <tr><td style="text-align:left;"><strong>Zelle ($)</strong></td><td>$${fmt(c.zelleUsd, 2)}</td><td><strong>€${fmt(enr.zelleEur, 2)}</strong></td></tr>
          </tbody>
          <tfoot>
            <tr>
              <td style="text-align:left;">TOTAL GENERAL DEL CIERRE (${esc(c.tipo || 'DIARIO')})</td>
              <td>$${fmt(c.totalUsd, 2)} / ${fmt(enr.anchoredBs, 2)} Bs</td>
              <td>€${fmt(eurVal, 2)}</td>
            </tr>
          </tfoot>
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
            <div><strong>Tasa Dólar BCV:</strong> ${fmt(rate, 2)} Bs/$</div>
            <div><strong>Tasa Euro BCV (€):</strong> ${fmt(getEuroRate(), 2)} Bs/€</div>
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

    // Tasa Oficial BCV ($ y € Euro) Automática + Edición Manual opcional
    document.getElementById('global-rate-input').addEventListener('input', e => {
      const r = parseFloat(e.target.value);
      if (r > 0) {
        state.exchangeRate = round2(r);
        saveState();
        updateLiveTotal();
        renderCajaDebtSection();
        renderSalesTable();
        renderCierreView();
        renderClientsView();
        renderInventoryView();
        renderReportsView();
      }
    });

    document.getElementById('global-euro-rate-input')?.addEventListener('input', e => {
      const rEur = parseFloat(e.target.value);
      if (rEur > 0) {
        state.euroRate = round2(rEur);
        state.exchangeRate = round2(rEur);
        const lblEur = document.getElementById('lbl-rate-eur');
        if (lblEur) lblEur.textContent = `${fmt(state.euroRate, 2)} Bs/€`;
        saveState();
        updateLiveTotal();
        renderDatalists();
        renderQuickButtons();
        renderCartItems();
        renderCajaDebtSection();
        renderSalesTable();
        renderCierreView();
        renderClientsView();
        renderInventoryView();
        renderReportsView();
      }
    });

    document.getElementById('btn-rate-bcv').addEventListener('click', () => {
      fetchBcvRateAuto(true);
    });

    document.getElementById('btn-rate-eur')?.addEventListener('click', () => {
      fetchBcvRateAuto(true);
    });

    document.getElementById('btn-sync-rate').addEventListener('click', () => {
      fetchBcvRateAuto(true);
    });

    document.getElementById('btn-sync-euro-cierre')?.addEventListener('click', () => {
      fetchBcvRateAuto(true);
    });

    // Anclar la tasa principal de Caja a la Tasa Oficial del Euro BCV con 1 clic
    const anchorCajaToEuro = () => {
      const eurRate = getEuroRate();
      if (eurRate > 0) {
        state.exchangeRate = round2(eurRate);
        const inp = document.getElementById('global-rate-input');
        if (inp) inp.value = state.exchangeRate.toFixed(2);
        saveState();
        renderAll();
        toast(`¡Caja anclada a la Tasa Oficial del Euro BCV (${fmt(eurRate, 2)} Bs/€)!`);
      }
    };
    document.getElementById('btn-anchor-caja-to-euro')?.addEventListener('click', anchorCajaToEuro);
    document.getElementById('btn-apply-euro-as-main')?.addEventListener('click', anchorCajaToEuro);

    document.getElementById('btn-go-full-closures')?.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      document.querySelector('.nav-btn[data-tab="cierre"]')?.classList.add('active');
      document.getElementById('tab-cierre')?.classList.add('active');
      renderCierreView();
    });

    // Pestañas de período de Cierre: DIARIO | SEMANAL | MENSUAL
    document.querySelectorAll('.period-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeClosurePeriod = btn.getAttribute('data-period') || 'DIARIO';
        document.querySelectorAll('.period-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderCierreView();
      });
    });

    document.getElementById('cierre-euro-mode-select')?.addEventListener('change', e => {
      state.euroAnchorMode = e.target.value || 'BCV_CONVERT';
      saveState();
      renderCajaEuroRenglon();
      renderCierreView();
    });

    document.getElementById('cierre-month-picker')?.addEventListener('change', () => {
      activeClosurePeriod = 'MENSUAL';
      document.querySelectorAll('.period-tab-btn').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-period') === 'MENSUAL');
      });
      renderCierreView();
    });

    document.getElementById('filter-closures-type')?.addEventListener('change', () => {
      renderCierreView();
    });

    document.getElementById('filter-closures-day')?.addEventListener('change', e => {
      const dayInp = document.getElementById('cierre-day-picker');
      if (dayInp) dayInp.value = e.target.value;
      renderCierreView();
    });

    document.getElementById('cierre-day-picker')?.addEventListener('change', e => {
      const histDayInp = document.getElementById('filter-closures-day');
      if (histDayInp) histDayInp.value = e.target.value;
      renderCierreView();
    });

    document.getElementById('btn-cierre-day-today')?.addEventListener('click', () => {
      const todayIso = new Date().toISOString().slice(0, 10);
      const dayInp = document.getElementById('cierre-day-picker');
      const histDayInp = document.getElementById('filter-closures-day');
      if (dayInp) dayInp.value = todayIso;
      if (histDayInp) histDayInp.value = todayIso;
      activeClosurePeriod = 'DIARIO';
      document.querySelectorAll('.period-tab-btn').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-period') === 'DIARIO');
      });
      renderCierreView();
    });

    const clearAllClosureFilters = () => {
      const dayInp = document.getElementById('cierre-day-picker');
      const histDayInp = document.getElementById('filter-closures-day');
      const typeSel = document.getElementById('filter-closures-type');
      if (dayInp) dayInp.value = '';
      if (histDayInp) histDayInp.value = '';
      if (typeSel) typeSel.value = 'ALL';
      activeClosurePeriod = 'TODOS';
      document.querySelectorAll('.period-tab-btn').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-period') === 'TODOS');
      });
      renderCierreView();
    };

    document.getElementById('btn-cierre-day-all')?.addEventListener('click', clearAllClosureFilters);
    document.getElementById('btn-clear-closures-filters')?.addEventListener('click', clearAllClosureFilters);

    document.getElementById('btn-export-closures-excel')?.addEventListener('click', () => {
      exportClosuresToExcel();
    });

    document.getElementById('btn-print-all-euro-closures')?.addEventListener('click', () => {
      openPrintableReport('EURO_CLOSURE_ALL');
    });

    document.getElementById('rep-btn-print-euro-closures')?.addEventListener('click', () => {
      openPrintableReport('EURO_CLOSURE_ALL');
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
    document.getElementById('print-cierre-btn').addEventListener('click', () =>
      openPrintableReport(activeClosurePeriod === 'TODOS' ? 'EURO_CLOSURE_ALL' : `EURO_CLOSURE_${activeClosurePeriod}`)
    );
    document.getElementById('print-clients-report-btn').addEventListener('click', () => openPrintableReport('CLIENTS'));
    document.getElementById('print-inv-report-btn').addEventListener('click', () => openPrintableReport('INVENTORY'));
    document.getElementById('rep-btn-print-sales').addEventListener('click', () => openPrintableReport('SALES'));
    document.getElementById('rep-btn-print-clients').addEventListener('click', () => openPrintableReport('CLIENTS'));
    document.getElementById('rep-btn-print-inv').addEventListener('click', () => openPrintableReport('INVENTORY'));

    // Guardar Cierre de Caja (Diario, Semanal o Mensual Anclado al Euro)
    document.getElementById('cierre-form').addEventListener('submit', e => {
      e.preventDefault();
      const nota = document.getElementById('cierre-nota').value.trim();
      saveClosureByPeriod(activeClosurePeriod, nota);
      document.getElementById('cierre-nota').value = '';
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
