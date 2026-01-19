-- =============================================
-- TELEGRAM APP - ESQUEMA DE BASE DE DATOS
-- Ejecutar en Supabase SQL Editor
-- =============================================

-- 1. Tabla de Vendedores
CREATE TABLE IF NOT EXISTS vendedores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id BIGINT UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabla de Arqueos (un registro por día por vendedor)
CREATE TABLE IF NOT EXISTS arqueos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendedor_id UUID REFERENCES vendedores(id) ON DELETE CASCADE,
    telegram_id BIGINT NOT NULL,
    fecha DATE NOT NULL,
    dia_semana TEXT,
    venta_bruta DECIMAL(12,2) DEFAULT 0,
    descuentos DECIMAL(12,2) DEFAULT 0,
    venta_total DECIMAL(12,2) DEFAULT 0,
    total_cobrado DECIMAL(12,2) DEFAULT 0,
    total_venta_credito DECIMAL(12,2) DEFAULT 0,
    total_gastos DECIMAL(12,2) DEFAULT 0,
    total_efectivo DECIMAL(12,2) DEFAULT 0,
    efectivo_entregado DECIMAL(12,2) DEFAULT 0,
    qr_entregado DECIMAL(12,2) DEFAULT 0,
    diferencia DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(telegram_id, fecha)
);

-- 3. Tabla de Créditos (detalle por arqueo)
CREATE TABLE IF NOT EXISTS creditos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    arqueo_id UUID REFERENCES arqueos(id) ON DELETE CASCADE,
    codigo_cliente TEXT NOT NULL,
    saldo_anterior DECIMAL(12,2) DEFAULT 0,
    cobrado DECIMAL(12,2) DEFAULT 0,
    venta_credito DECIMAL(12,2) DEFAULT 0,
    saldo_nuevo DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabla de Gastos (detalle por arqueo)
CREATE TABLE IF NOT EXISTS gastos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    arqueo_id UUID REFERENCES arqueos(id) ON DELETE CASCADE,
    concepto TEXT NOT NULL,
    monto DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Tabla de Clientes (saldos actuales)
CREATE TABLE IF NOT EXISTS clientes (
    codigo TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    saldo DECIMAL(12,2) DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Tabla de Rutas (clientes por día por vendedor)
CREATE TABLE IF NOT EXISTS rutas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id BIGINT NOT NULL,
    dia_semana TEXT NOT NULL, -- 'LUN', 'MAR', etc.
    codigo_cliente TEXT NOT NULL,
    nombre_cliente TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(telegram_id, dia_semana, codigo_cliente)
);

-- 7. Tabla de Historial de Visitas
CREATE TABLE IF NOT EXISTS historial_visitas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id BIGINT NOT NULL,
    fecha DATE NOT NULL,
    dia_programado TEXT,
    dia_real TEXT,
    visitas JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(telegram_id, fecha)
);

-- =============================================
-- ÍNDICES para mejor rendimiento
-- =============================================
CREATE INDEX IF NOT EXISTS idx_arqueos_telegram_fecha ON arqueos(telegram_id, fecha);
CREATE INDEX IF NOT EXISTS idx_creditos_arqueo ON creditos(arqueo_id);
CREATE INDEX IF NOT EXISTS idx_gastos_arqueo ON gastos(arqueo_id);
CREATE INDEX IF NOT EXISTS idx_rutas_telegram_dia ON rutas(telegram_id, dia_semana);
CREATE INDEX IF NOT EXISTS idx_historial_telegram_fecha ON historial_visitas(telegram_id, fecha);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

-- Habilitar RLS en todas las tablas
ALTER TABLE vendedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE arqueos ENABLE ROW LEVEL SECURITY;
ALTER TABLE creditos ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE rutas ENABLE ROW LEVEL SECURITY;
ALTER TABLE historial_visitas ENABLE ROW LEVEL SECURITY;

-- Políticas permisivas (por ahora permitir todo para anon)
-- En producción, ajustar para validar telegram_id
CREATE POLICY "Allow all for anon" ON vendedores FOR ALL USING (true);
CREATE POLICY "Allow all for anon" ON arqueos FOR ALL USING (true);
CREATE POLICY "Allow all for anon" ON creditos FOR ALL USING (true);
CREATE POLICY "Allow all for anon" ON gastos FOR ALL USING (true);
CREATE POLICY "Allow all for anon" ON clientes FOR ALL USING (true);
CREATE POLICY "Allow all for anon" ON rutas FOR ALL USING (true);
CREATE POLICY "Allow all for anon" ON historial_visitas FOR ALL USING (true);

-- =============================================
-- FUNCIÓN para actualizar updated_at automáticamente
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para arqueos
CREATE TRIGGER update_arqueos_updated_at
    BEFORE UPDATE ON arqueos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Trigger para clientes
CREATE TRIGGER update_clientes_updated_at
    BEFORE UPDATE ON clientes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
