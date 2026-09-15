-- =============================================================================
-- Devenga — Fase 0 (§10 de la especificación)
--
-- Alcance de este schema: matriz legal por país (§7), catálogo de conceptos
-- con clasificación (§2.5), política de aprobaciones (§4) y esquema del
-- movimiento de devengo (§3.8). NO incluye dato maestro transaccional
-- (sociedad, comisionado, plan, transacción) — eso es Fase 1 (§10).
--
-- RLS: se difiere a Fase 1, cuando exista el modelo de sociedad/comisionado
-- contra el cual anclar las políticas. Sin ese anclaje, cualquier política
-- aquí sería una promesa vacía.
-- =============================================================================

create extension if not exists "uuid-ossp";

-- -----------------------------------------------------------------------------
-- País — §2.1. Entidad raíz. No hay objeto sin país.
-- -----------------------------------------------------------------------------
create table public.paises (
  codigo_pais text primary key check (codigo_pais in ('CL', 'PE', 'CO', 'MX', 'AR')),
  nombre text not null,
  moneda_funcional text not null,
  regimen_legal_version text not null default '2026-09-14',
  estado text not null default 'en_implementacion' check (estado in ('activo', 'en_implementacion', 'congelado')),
  created_at timestamptz default now()
);

insert into public.paises (codigo_pais, nombre, moneda_funcional) values
  ('CL', 'Chile', 'CLP'),
  ('PE', 'Perú', 'PEN'),
  ('CO', 'Colombia', 'COP'),
  ('MX', 'México', 'MXN'),
  ('AR', 'Argentina', 'ARS');

-- -----------------------------------------------------------------------------
-- Matriz legal por país — §7. Esta tabla ES el producto.
-- -----------------------------------------------------------------------------
create table public.matriz_legal_pais (
  pais text primary key references public.paises(codigo_pais),
  regla_comision text not null,
  confianza_calificacion text not null check (confianza_calificacion in ('seguro', 'probable', 'suposicion')),
  riesgo_declarado text,
  updated_at timestamptz default now()
);

create table public.matriz_legal_incidencia (
  id uuid primary key default uuid_generate_v4(),
  pais text not null references public.matriz_legal_pais(pais),
  beneficio text not null,
  ventana_calculo text not null,
  confianza text not null check (confianza in ('seguro', 'probable', 'suposicion')),
  unique (pais, beneficio)
);

-- -----------------------------------------------------------------------------
-- Concepto — §2.5. Objeto central: todo importe que sale del motor pertenece
-- a un concepto, y el concepto lleva su clasificación legal.
-- -----------------------------------------------------------------------------
create table public.conceptos (
  codigo text primary key,
  nombre text not null,
  pais text not null references public.paises(codigo_pais),
  naturaleza text not null check (naturaleza in ('comision', 'premio', 'spif', 'override', 'bono_meta', 'ajuste')),
  base_devengo text not null check (base_devengo in ('unidad_vendida', 'meta_individual', 'meta_grupal', 'mixta')),
  evento_devengo text not null check (evento_devengo in ('firma', 'despacho', 'facturacion', 'cobro', 'otro')),

  -- Sin default: debe resolverse explícitamente en cada fila (§2.5).
  devengo_diario boolean not null,
  fundamento_devengo_diario text not null,

  principalidad text not null check (principalidad in ('principal', 'accesorio')),
  ordinariedad text not null check (ordinariedad in ('ordinario', 'extraordinario')),
  remunerativo boolean not null,

  -- Beneficios derivados afectados. Validado en app contra matriz_legal_incidencia
  -- (un array no puede tener FK nativa por elemento en Postgres).
  incide_en text[] not null default '{}',

  granularidad_entrega text not null check (granularidad_entrega in ('diaria', 'mensual')),
  reversible boolean not null default true,
  causales_reversion text[],
  mapeo_nomina text,
  tope_concepto numeric,
  vigencia_desde date not null,
  vigencia_hasta date,

  created_at timestamptz default now(),

  -- §0.3 — devengo_diario = true fuerza granularidad diaria, sin excepción.
  constraint devengo_diario_fuerza_granularidad
    check (not devengo_diario or granularidad_entrega = 'diaria'),

  -- §2.5 — fundamento obligatorio con sustancia real, no un valor de relleno.
  constraint fundamento_no_trivial
    check (char_length(fundamento_devengo_diario) >= 20),

  -- §3.4 — Chile bloquea el evento de devengo "cobro".
  constraint cl_bloquea_evento_cobro
    check (not (pais = 'CL' and evento_devengo = 'cobro'))
);

-- §2.5 — validación bloqueante: sin incide_en[] poblado, el concepto no puede
-- entrar a un plan. Se aplica como trigger porque un CHECK no puede reusarse
-- entre INSERT/UPDATE con este nivel de mensaje.
create or replace function public.fn_concepto_incide_en_no_vacio()
returns trigger as $$
begin
  if new.incide_en is null or array_length(new.incide_en, 1) is null then
    raise exception 'Concepto %: incide_en[] vacío — no puede usarse en un plan sin clasificación legal (§2.5)', new.codigo;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_concepto_incide_en_no_vacio
  before insert or update on public.conceptos
  for each row execute function public.fn_concepto_incide_en_no_vacio();

-- -----------------------------------------------------------------------------
-- Política de aprobaciones — §4. Tablas de referencia (catálogo, no workflow).
-- -----------------------------------------------------------------------------
create table public.puertas_aprobacion (
  numero int primary key,
  nombre text not null,
  que_se_confirma text not null,
  quien text not null,
  que_queda text not null
);

insert into public.puertas_aprobacion (numero, nombre, que_se_confirma, quien, que_queda) values
  (1, 'Aprobación de plantilla', 'Estructura y costo proyectado', 'Dueño comercial + control de gestión', 'Versión firmada, simulación adjunta'),
  (2, 'Aprobación de meta', 'Magnitud y destino', 'Jefatura según workflow de la sociedad', 'Versión de meta con motivo'),
  (3, 'Autorización de campaña', 'Multiplicador, alcance retroactivo, presupuesto', 'Nivel según monto proyectado', 'Autorización previa a publicación'),
  (4, 'Congelamiento de cálculo', 'Nada cambia desde aquí', 'Automático al corte', 'Snapshot + hash'),
  (5, 'Aprobación de liquidación', 'Importes a enviar a nómina', 'Jefatura comercial + control', 'Acta con totales y excepciones'),
  (6, 'Acuse de pago', 'Lo enviado fue pagado', 'Nómina', 'Conciliación cerrada');

create table public.controles_bloqueantes (
  id uuid primary key default uuid_generate_v4(),
  descripcion text not null unique
);

insert into public.controles_bloqueantes (descripcion) values
  ('Transacción en cuarentena sin resolver'),
  ('Split que no suma 100%'),
  ('Comisionado sin vínculo laboral vigente a la fecha_devengo'),
  ('Concepto sin devengo_diario resuelto o sin incide_en[] para el país'),
  ('Campaña publicada sin autorización registrada'),
  ('Override sin motivo o sin aprobador'),
  ('Meta en estado borrador con resultados calculados contra ella'),
  ('Tipo de cambio faltante para alguna moneda del período'),
  ('Diferencia entre el total calculado y el total de movimientos generados'),
  ('Monto que excede presupuesto_tope de campaña sin autorización superior');

create table public.segregacion_funciones (
  id uuid primary key default uuid_generate_v4(),
  rol_a text not null,
  rol_b text not null,
  motivo text not null,
  unique (rol_a, rol_b)
);

insert into public.segregacion_funciones (rol_a, rol_b, motivo) values
  ('carga_metas', 'aprueba_metas', 'Quien carga metas no aprueba metas'),
  ('diseña_planes', 'aprueba_liquidaciones', 'Quien diseña planes no aprueba liquidaciones'),
  ('resuelve_disputas', 'aprueba_ajustes_propios', 'Quien resuelve disputas no aprueba ajustes propios');

-- -----------------------------------------------------------------------------
-- Movimiento de devengo — §3.8. Único objeto de entrega a nómina (ida).
-- Inmutable: una corrección nunca reemite un movimiento, genera uno nuevo (§3.11).
-- -----------------------------------------------------------------------------
create table public.movimientos_devengo (
  id_movimiento uuid primary key default uuid_generate_v4(),
  comisionado text not null,       -- referencia lógica; FK real llega en Fase 1
  sociedad text not null,          -- referencia lógica; FK real llega en Fase 1
  pais text not null references public.paises(codigo_pais),
  concepto text not null references public.conceptos(codigo),
  mapeo_nomina text not null,
  importe numeric not null,
  moneda text not null,

  periodo_origen text not null,      -- yyyy-mm — determina el tratamiento legal (§1.3)
  periodo_imputacion text not null,  -- yyyy-mm — determina cuándo se paga (§1.3)

  devengo_diario boolean not null,
  detalle_diario jsonb,              -- [{fecha, importe}] — obligatorio si devengo_diario (§0.3)

  principalidad text not null check (principalidad in ('principal', 'accesorio')),
  ordinariedad text not null check (ordinariedad in ('ordinario', 'extraordinario')),
  remunerativo boolean not null,
  incide_en text[] not null,

  hash_detalle text not null,
  url_documento text,

  estado text not null default 'enviado' check (estado in ('enviado', 'acusado', 'pagado', 'rechazado')),

  created_at timestamptz default now(),

  constraint devengo_diario_exige_detalle
    check (not devengo_diario or detalle_diario is not null),

  constraint incide_en_no_vacio
    check (array_length(incide_en, 1) is not null)
);

-- -----------------------------------------------------------------------------
-- Acuse de nómina — §3.9. Vuelta del movimiento de devengo.
-- -----------------------------------------------------------------------------
create table public.acuses_nomina (
  id uuid primary key default uuid_generate_v4(),
  id_movimiento uuid not null references public.movimientos_devengo(id_movimiento),
  periodo_liquidado text not null,
  monto_bruto_pagado numeric not null,
  estado text not null check (estado in ('enviado', 'acusado', 'pagado', 'rechazado')),
  id_documento_publicado text not null,
  fecha date not null,
  -- true solo en modo Excel: registrado como "declarado", no "confirmado" (§3.9)
  declarado_no_confirmado boolean not null default false,
  created_at timestamptz default now()
);
