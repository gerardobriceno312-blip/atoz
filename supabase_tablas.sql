-- ============================================================================
-- BODEGÓN & MARKET ATO'Z - SCRIPT COMPLETO DE TABLAS PARA SUPABASE
-- Instrucciones: Copia todo este código, entra a tu proyecto en Supabase ->
-- "SQL Editor" -> "New Query", pégalo y presiona "RUN".
-- ============================================================================

-- 1. Tabla de Sincronización Principal en Tiempo Real (Estado Completo Multi-PC)
CREATE TABLE IF NOT EXISTS public.atoz_cloud_state (
  id TEXT PRIMARY KEY DEFAULT 'principal',
  updated_at TIMESTAMPTZ DEFAULT now(),
  exchange_rate NUMERIC(12,2) DEFAULT 1000.00,
  payload JSONB NOT NULL
);

-- 2. Tabla de Productos e Inventario
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

-- 3. Tabla de Clientes, Deudas, Saldos a Favor y Detalle de Productos Fiados
CREATE TABLE IF NOT EXISTS public.atoz_clientes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  deuda NUMERIC(12,2) DEFAULT 0,
  a_favor NUMERIC(12,2) DEFAULT 0,
  note TEXT DEFAULT '',
  items_pendientes JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Tabla de Ventas / Hoja de Consumo Diario
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

-- 5. Tabla de Cierres de Caja
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

-- 6. Tabla de Usuarios y Cajeros
CREATE TABLE IF NOT EXISTS public.atoz_usuarios (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'CAJERO',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar políticas de acceso público para que todas las PCs sincronizen sin bloqueo
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
CREATE POLICY "Acceso total atoz_usuarios" ON public.atoz_usuarios FOR ALL USING (true) WITH CHECK (true);
