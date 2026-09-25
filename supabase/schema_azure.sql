-- ============================================================
-- SCHEMA LIMPIO PARA AZURE POSTGRESQL
-- Sin RLS, sin auth.users, sin auth.uid()
-- Tabla usuarios propia para NextAuth + bcrypt
-- ============================================================

-- Extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- AUTENTICACIÓN PROPIA
-- ============================================================
CREATE TABLE IF NOT EXISTS usuarios (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email           TEXT UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  nombre          TEXT NOT NULL DEFAULT '',
  email_verified_at TIMESTAMPTZ,
  invited_by      UUID REFERENCES usuarios(id),
  invitation_token TEXT UNIQUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- MULTI-TENANT
-- ============================================================
CREATE TABLE IF NOT EXISTS tenant (
  id_tenant         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre_comercial  TEXT NOT NULL,
  pais_base         TEXT NOT NULL DEFAULT 'CL',
  plan              TEXT NOT NULL DEFAULT 'starter',
  activo            BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS usuario_tenant (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id      UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES tenant(id_tenant) ON DELETE CASCADE,
  rol_base        TEXT NOT NULL DEFAULT 'viewer',
  activo          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (usuario_id, tenant_id)
);

-- ============================================================
-- CATÁLOGOS
-- ============================================================
CREATE TABLE IF NOT EXISTS pais (
  codigo  TEXT PRIMARY KEY,
  nombre  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tipo_cambio (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenant(id_tenant) ON DELETE CASCADE,
  moneda_origen   TEXT NOT NULL,
  moneda_destino  TEXT NOT NULL,
  tasa            NUMERIC(18,6) NOT NULL,
  vigente_desde   DATE NOT NULL,
  vigente_hasta   DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SOCIEDADES Y PERMISOS
-- ============================================================
CREATE TABLE IF NOT EXISTS sociedad (
  id_sociedad     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenant(id_tenant) ON DELETE CASCADE,
  nombre          TEXT NOT NULL,
  pais            TEXT NOT NULL,
  moneda          TEXT NOT NULL DEFAULT 'CLP',
  activa          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS usuario_permiso_sociedad (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id  UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  sociedad_id UUID NOT NULL REFERENCES sociedad(id_sociedad) ON DELETE CASCADE,
  permiso     TEXT NOT NULL DEFAULT 'read',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (usuario_id, sociedad_id, permiso)
);

-- ============================================================
-- JERARQUÍA
-- ============================================================
CREATE TABLE IF NOT EXISTS jefe_nodo (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenant(id_tenant) ON DELETE CASCADE,
  usuario_id  UUID NOT NULL REFERENCES usuarios(id),
  nombre      TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nodo_jerarquia (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenant(id_tenant) ON DELETE CASCADE,
  sociedad_id     UUID REFERENCES sociedad(id_sociedad),
  padre_id        UUID REFERENCES nodo_jerarquia(id),
  jefe_nodo_id    UUID REFERENCES jefe_nodo(id),
  nombre          TEXT NOT NULL,
  nivel           INT NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS territorio (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenant(id_tenant) ON DELETE CASCADE,
  sociedad_id UUID REFERENCES sociedad(id_sociedad),
  nombre      TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- COMISIONADOS
-- ============================================================
CREATE TABLE IF NOT EXISTS comisionados (
  id_comisionado  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenant(id_tenant) ON DELETE CASCADE,
  usuario_id      UUID REFERENCES usuarios(id),
  nombre          TEXT NOT NULL,
  email           TEXT,
  rut             TEXT,
  activo          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comisionado_sociedad (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  comisionado_id  UUID NOT NULL REFERENCES comisionados(id_comisionado) ON DELETE CASCADE,
  sociedad_id     UUID NOT NULL REFERENCES sociedad(id_sociedad) ON DELETE CASCADE,
  nodo_id         UUID REFERENCES nodo_jerarquia(id),
  activo          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (comisionado_id, sociedad_id)
);

-- ============================================================
-- PLANES Y COMPONENTES
-- ============================================================
CREATE TABLE IF NOT EXISTS concepto (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenant(id_tenant) ON DELETE CASCADE,
  nombre      TEXT NOT NULL,
  tipo        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plantilla_plan (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenant(id_tenant) ON DELETE CASCADE,
  sociedad_id UUID REFERENCES sociedad(id_sociedad),
  nombre      TEXT NOT NULL,
  descripcion TEXT,
  activa      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS componente_plan (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plantilla_plan_id UUID NOT NULL REFERENCES plantilla_plan(id) ON DELETE CASCADE,
  concepto_id       UUID REFERENCES concepto(id),
  nombre            TEXT NOT NULL,
  tipo              TEXT NOT NULL,
  parametros        JSONB,
  orden             INT NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS asignacion_plan (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  comisionado_id    UUID NOT NULL REFERENCES comisionados(id_comisionado) ON DELETE CASCADE,
  plantilla_plan_id UUID NOT NULL REFERENCES plantilla_plan(id),
  sociedad_id       UUID REFERENCES sociedad(id_sociedad),
  vigente_desde     DATE NOT NULL,
  vigente_hasta     DATE,
  activa            BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS override_plan (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asignacion_plan_id UUID NOT NULL REFERENCES asignacion_plan(id) ON DELETE CASCADE,
  componente_plan_id UUID NOT NULL REFERENCES componente_plan(id),
  parametros_override JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS acuse_plan (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asignacion_plan_id  UUID NOT NULL REFERENCES asignacion_plan(id) ON DELETE CASCADE,
  comisionado_id      UUID NOT NULL REFERENCES comisionados(id_comisionado),
  acusado_en          TIMESTAMPTZ,
  ip                  TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- METAS Y CAMPAÑAS
-- ============================================================
CREATE TABLE IF NOT EXISTS meta (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenant(id_tenant) ON DELETE CASCADE,
  sociedad_id     UUID REFERENCES sociedad(id_sociedad),
  comisionado_id  UUID REFERENCES comisionados(id_comisionado),
  nombre          TEXT NOT NULL,
  tipo            TEXT,
  valor_objetivo  NUMERIC(18,4),
  periodo_inicio  DATE,
  periodo_fin     DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campana (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id             UUID NOT NULL REFERENCES tenant(id_tenant) ON DELETE CASCADE,
  sociedad_id           UUID REFERENCES sociedad(id_sociedad),
  nombre                TEXT NOT NULL,
  descripcion           TEXT,
  fecha_inicio          DATE,
  fecha_fin             DATE,
  alcance_retroactivo   TEXT DEFAULT 'false',
  activa                BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TRANSACCIONES Y FUENTES
-- ============================================================
CREATE TABLE IF NOT EXISTS fuente (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenant(id_tenant) ON DELETE CASCADE,
  sociedad_id     UUID REFERENCES sociedad(id_sociedad),
  nombre          TEXT NOT NULL,
  sistema_origen  TEXT,
  activa          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transaccion (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenant(id_tenant) ON DELETE CASCADE,
  sociedad_id     UUID REFERENCES sociedad(id_sociedad),
  fuente_id       UUID REFERENCES fuente(id),
  comisionado_id  UUID REFERENCES comisionados(id_comisionado),
  concepto_id     UUID REFERENCES concepto(id),
  monto           NUMERIC(18,4) NOT NULL DEFAULT 0,
  fecha           DATE NOT NULL,
  referencia      TEXT,
  estado          TEXT NOT NULL DEFAULT 'pendiente',
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transaccion_split (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaccion_id  UUID NOT NULL REFERENCES transaccion(id) ON DELETE CASCADE,
  comisionado_id  UUID REFERENCES comisionados(id_comisionado),
  porcentaje      NUMERIC(5,4),
  monto           NUMERIC(18,4),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transaccion_cuarentena (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenant(id_tenant) ON DELETE CASCADE,
  sociedad_id     UUID REFERENCES sociedad(id_sociedad),
  datos_raw       JSONB,
  motivo          TEXT,
  estado          TEXT NOT NULL DEFAULT 'pendiente',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PERÍODOS Y CÁLCULO
-- ============================================================
CREATE TABLE IF NOT EXISTS periodo (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenant(id_tenant) ON DELETE CASCADE,
  sociedad_id     UUID REFERENCES sociedad(id_sociedad),
  nombre          TEXT NOT NULL,
  fecha_inicio    DATE NOT NULL,
  fecha_fin       DATE NOT NULL,
  estado          TEXT NOT NULL DEFAULT 'abierto',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS credito (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenant(id_tenant) ON DELETE CASCADE,
  comisionado_id  UUID NOT NULL REFERENCES comisionados(id_comisionado),
  periodo_id      UUID REFERENCES periodo(id),
  monto           NUMERIC(18,4) NOT NULL,
  motivo          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS resultado_calculo (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenant(id_tenant) ON DELETE CASCADE,
  periodo_id      UUID NOT NULL REFERENCES periodo(id) ON DELETE CASCADE,
  comisionado_id  UUID NOT NULL REFERENCES comisionados(id_comisionado),
  sociedad_id     UUID REFERENCES sociedad(id_sociedad),
  monto_bruto     NUMERIC(18,4),
  monto_neto      NUMERIC(18,4),
  estado          TEXT NOT NULL DEFAULT 'borrador',
  calculado_en    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS movimiento_devengo (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resultado_calculo_id UUID NOT NULL REFERENCES resultado_calculo(id) ON DELETE CASCADE,
  concepto_id         UUID REFERENCES concepto(id),
  descripcion         TEXT,
  monto               NUMERIC(18,4),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS acuse_nomina (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resultado_calculo_id UUID NOT NULL REFERENCES resultado_calculo(id) ON DELETE CASCADE,
  comisionado_id      UUID NOT NULL REFERENCES comisionados(id_comisionado),
  acusado_en          TIMESTAMPTZ,
  ip                  TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS aprobacion_periodo (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  periodo_id  UUID NOT NULL REFERENCES periodo(id) ON DELETE CASCADE,
  usuario_id  UUID NOT NULL REFERENCES usuarios(id),
  aprobado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  comentario  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- DISPUTAS
-- ============================================================
CREATE TABLE IF NOT EXISTS disputa (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id           UUID NOT NULL REFERENCES tenant(id_tenant) ON DELETE CASCADE,
  resultado_calculo_id UUID REFERENCES resultado_calculo(id),
  comisionado_id      UUID NOT NULL REFERENCES comisionados(id_comisionado),
  motivo              TEXT NOT NULL,
  estado              TEXT NOT NULL DEFAULT 'abierta',
  resolucion          TEXT,
  creado_por          UUID REFERENCES usuarios(id),
  resuelto_por        UUID REFERENCES usuarios(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- NOTIFICACIONES
-- ============================================================
CREATE TABLE IF NOT EXISTS notificacion (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id  UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tenant_id   UUID REFERENCES tenant(id_tenant),
  tipo        TEXT NOT NULL,
  titulo      TEXT NOT NULL,
  cuerpo      TEXT,
  leida       BOOLEAN NOT NULL DEFAULT false,
  url         TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INTEGRACIONES
-- ============================================================
CREATE TABLE IF NOT EXISTS integracion (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenant(id_tenant) ON DELETE CASCADE,
  nombre      TEXT NOT NULL,
  tipo        TEXT NOT NULL,
  config      JSONB,
  activa      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS log_integracion (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  integracion_id  UUID NOT NULL REFERENCES integracion(id) ON DELETE CASCADE,
  evento          TEXT NOT NULL,
  payload         JSONB,
  resultado       JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS integracion_usuario (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  integracion_id  UUID NOT NULL REFERENCES integracion(id) ON DELETE CASCADE,
  usuario_id      UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  config          JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (integracion_id, usuario_id)
);

-- ============================================================
-- AUDITORÍA
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID REFERENCES tenant(id_tenant),
  usuario_id  UUID REFERENCES usuarios(id),
  tabla       TEXT NOT NULL,
  operacion   TEXT NOT NULL,
  registro_id TEXT,
  antes       JSONB,
  despues     JSONB,
  ip          TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CONTROLES DE CUMPLIMIENTO
-- ============================================================
CREATE TABLE IF NOT EXISTS matriz_legal_pais (
  id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pais    TEXT NOT NULL,
  nombre  TEXT NOT NULL,
  detalle TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS matriz_legal_incidencia (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  matriz_legal_pais_id UUID NOT NULL REFERENCES matriz_legal_pais(id) ON DELETE CASCADE,
  tenant_id           UUID REFERENCES tenant(id_tenant),
  sociedad_id         UUID REFERENCES sociedad(id_sociedad),
  aplica              BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS puerta_aprobacion (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenant(id_tenant) ON DELETE CASCADE,
  nombre      TEXT NOT NULL,
  tipo        TEXT NOT NULL,
  orden       INT NOT NULL DEFAULT 0,
  activa      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS control_bloqueante (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenant(id_tenant) ON DELETE CASCADE,
  nombre      TEXT NOT NULL,
  descripcion TEXT,
  activo      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS segregacion_funciones (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenant(id_tenant) ON DELETE CASCADE,
  rol_a       TEXT NOT NULL,
  rol_b       TEXT NOT NULL,
  descripcion TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES BÁSICOS
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_usuario_tenant_usuario ON usuario_tenant(usuario_id);
CREATE INDEX IF NOT EXISTS idx_usuario_tenant_tenant ON usuario_tenant(tenant_id);
CREATE INDEX IF NOT EXISTS idx_comisionado_tenant ON comisionados(tenant_id);
CREATE INDEX IF NOT EXISTS idx_transaccion_tenant ON transaccion(tenant_id);
CREATE INDEX IF NOT EXISTS idx_transaccion_fecha ON transaccion(fecha);
CREATE INDEX IF NOT EXISTS idx_resultado_periodo ON resultado_calculo(periodo_id);
CREATE INDEX IF NOT EXISTS idx_notificacion_usuario ON notificacion(usuario_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_tenant ON audit_log(tenant_id);
