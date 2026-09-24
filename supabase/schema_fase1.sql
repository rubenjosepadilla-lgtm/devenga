-- =============================================================================
-- Devenga — Fase 1 (§10 de la especificación)
--
-- Núcleo: dato maestro (sociedad, comisionado, jerarquía, plan, meta, campaña,
-- fuente, transacción), ingesta, atribución, cálculo, cierre y movimiento de
-- devengo. Cubre los cinco países (decisión de esta sesión, ver
-- docs/fase-0/05-riesgos.md).
--
-- Requiere supabase/schema.sql + supabase/seed_fase0.sql ya aplicados.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- §2.1 — Completar País con los campos que Fase 0 no necesitaba.
-- -----------------------------------------------------------------------------
alter table public.paises
  add column if not exists calendario_laboral jsonb not null default '{"feriados": []}',
  add column if not exists politica_datos_personales text;

update public.paises set politica_datos_personales = v.politica from (values
  ('CL', 'Ley 21.719 (vigente 1-dic-2026)'),
  ('PE', 'Ley 29.733'),
  ('CO', 'Ley 1581 de 2012'),
  ('MX', 'LFPDPPP'),
  ('AR', 'Ley 25.326')
) as v(codigo, politica)
where paises.codigo_pais = v.codigo;

-- -----------------------------------------------------------------------------
-- Usuarios y roles — soporte para segregación de funciones (§4.4) y RLS.
-- No está en el texto literal de la especificación (que habla de "roles", no
-- de un modelo de auth concreto): es la implementación mínima necesaria para
-- que las seis puertas (§4.1) y la segregación (§4.4) sean controles reales,
-- no solo documentados.
-- -----------------------------------------------------------------------------
create table public.usuarios_app (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  email text not null unique,
  created_at timestamptz default now()
);

create type public.rol_sociedad as enum (
  'admin',
  'dueño_comercial',
  'control_gestion',
  'jefatura_comercial',
  'disenador_planes',
  'carga_metas',
  'aprueba_metas',
  'autoriza_campanas',
  'resuelve_disputas',
  'nomina',
  'lectura'
);

create table public.sociedades (
  id_sociedad uuid primary key default uuid_generate_v4(),
  pais text not null references public.paises(codigo_pais),
  identificador_fiscal text not null,
  nombre text not null,
  sistema_nomina text not null check (sistema_nomina in ('suel2', 'sap', 'otro', 'excel')),
  modo_integracion text not null check (modo_integracion in ('api', 'archivo', 'manual')),
  calendario_periodos text not null default 'mensual' check (calendario_periodos in ('mensual', 'quincenal', 'semanal')),
  dia_corte_comisiones int not null check (dia_corte_comisiones between 1 and 28),
  responsable_aprobacion text not null,
  creado_por uuid not null references auth.users(id),
  created_at timestamptz default now(),
  unique (pais, identificador_fiscal)
);

create table public.usuario_rol_sociedad (
  id uuid primary key default uuid_generate_v4(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  sociedad_id uuid not null references public.sociedades(id_sociedad) on delete cascade,
  rol public.rol_sociedad not null,
  created_at timestamptz default now(),
  unique (usuario_id, sociedad_id, rol)
);

-- Alta automática de la sociedad crea a su creador como admin.
create or replace function public.fn_alta_admin_sociedad()
returns trigger as $$
begin
  insert into public.usuario_rol_sociedad (usuario_id, sociedad_id, rol)
  values (new.creado_por, new.id_sociedad, 'admin');
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_alta_admin_sociedad
  after insert on public.sociedades
  for each row execute function public.fn_alta_admin_sociedad();

create or replace function public.es_miembro_sociedad(p_sociedad uuid)
returns boolean as $$
  select exists (
    select 1 from public.usuario_rol_sociedad
    where usuario_id = auth.uid() and sociedad_id = p_sociedad
  );
$$ language sql security definer stable;

create or replace function public.tiene_rol_en_sociedad(p_sociedad uuid, p_roles public.rol_sociedad[])
returns boolean as $$
  select exists (
    select 1 from public.usuario_rol_sociedad
    where usuario_id = auth.uid() and sociedad_id = p_sociedad and rol = any(p_roles)
  );
$$ language sql security definer stable;

-- -----------------------------------------------------------------------------
-- §2.3 — Comisionado. Identidad gobernada por país (no multipaís en v1).
-- -----------------------------------------------------------------------------
create table public.comisionados (
  id_comisionado uuid primary key default uuid_generate_v4(),
  pais text not null references public.paises(codigo_pais),
  identificador_personal text not null,
  tipo text not null check (tipo in ('dependiente', 'no_dependiente')),
  vigencia_desde date not null,
  vigencia_hasta date,
  created_at timestamptz default now(),
  unique (pais, identificador_personal)
);

-- Vínculo comisionado × sociedad, versionado con vigencia (§2.3).
create table public.comisionado_sociedad (
  id uuid primary key default uuid_generate_v4(),
  comisionado_id uuid not null references public.comisionados(id_comisionado),
  sociedad_id uuid not null references public.sociedades(id_sociedad),
  desde date not null,
  hasta date,
  id_en_nomina text not null,
  centro_costo text,
  rol_comercial text,
  -- Multi-sociedad: excepción declarada (§2.3, §9 riesgo #5). Requiere aprobación adicional.
  participacion numeric check (participacion > 0 and participacion <= 100),
  participacion_motivo text,
  participacion_aprobado_por text,
  participacion_aprobado_en timestamptz,
  created_at timestamptz default now(),
  constraint participacion_exige_aprobacion
    check (participacion is null or (participacion_motivo is not null and participacion_aprobado_por is not null))
);

-- -----------------------------------------------------------------------------
-- §2.4 — Jerarquía y territorio. Propio del motor, nunca espejo en vivo.
-- -----------------------------------------------------------------------------
create table public.nodos_jerarquia (
  id_nodo uuid primary key default uuid_generate_v4(),
  sociedad_id uuid not null references public.sociedades(id_sociedad),
  tipo text not null check (tipo in ('equipo', 'celula', 'zona', 'canal', 'territorio')),
  nodo_padre uuid references public.nodos_jerarquia(id_nodo),
  titular uuid references public.comisionados(id_comisionado),
  vigencia_desde date not null,
  vigencia_hasta date,
  motivo_cambio text not null,
  aprobado_por text not null,
  aprobado_en timestamptz not null,
  -- Excepción configurable de §2.4: por defecto se congela a fecha_credito;
  -- con aprobación registrada puede cortar el mes completo a favor de uno u otro.
  tratamiento_corte text not null default 'congelado_a_fecha_credito'
    check (tratamiento_corte in ('congelado_a_fecha_credito', 'mes_completo_saliente', 'mes_completo_entrante')),
  created_at timestamptz default now(),
  constraint motivo_no_trivial check (char_length(motivo_cambio) >= 10)
);

-- -----------------------------------------------------------------------------
-- §2.6 — Plan: plantilla → componente → asignación → override.
-- `sociedad_id` en plantilla no está en el texto literal de la especificación
-- (que solo menciona `pais`); se agrega porque la aprobación de plantilla
-- (puerta 1, §4.1) y el costo proyectado son por sociedad, no por país.
-- -----------------------------------------------------------------------------
create table public.plantillas_plan (
  id uuid primary key default uuid_generate_v4(),
  sociedad_id uuid not null references public.sociedades(id_sociedad),
  nombre text not null,
  pais text not null references public.paises(codigo_pais),
  periodicidad text not null check (periodicidad in ('diaria', 'semanal', 'mensual', 'trimestral')),
  moneda text not null,
  vigencia_desde date not null,
  vigencia_hasta date,
  estado text not null default 'borrador' check (estado in ('borrador', 'aprobado', 'vigente', 'cerrado')),
  version int not null default 1,
  -- Puerta 1 (§4.1): aprobación de plantilla.
  aprobado_por text,
  aprobado_en timestamptz,
  simulacion_adjunta jsonb,
  created_at timestamptz default now(),
  constraint aprobado_exige_evidencia
    check (estado = 'borrador' or (aprobado_por is not null and aprobado_en is not null))
);

create table public.componentes_plan (
  id uuid primary key default uuid_generate_v4(),
  plantilla_id uuid not null references public.plantillas_plan(id) on delete cascade,
  tipo text not null check (tipo in (
    'tasa_lineal', 'escalonado_marginal', 'escalonado_total', 'multiplicador_por_logro',
    'monto_fijo_por_hito', 'override_jerarquia', 'pool_equipo', 'campaña'
  )),
  concepto_codigo text not null references public.conceptos(codigo),
  base_medicion text not null check (base_medicion in ('unidades', 'monto', 'margen', 'mix')),
  filtro_elegibilidad jsonb not null default '{}',
  -- No está en el texto literal de §2.6 (que no especifica dónde vive la tasa o
  -- los tramos): es la superficie de configuración numérica del componente
  -- (tasa, tramos, tabla de multiplicadores, monto de hito). Un override
  -- puede sobreescribir una clave puntual de este objeto para una asignación.
  parametros jsonb not null default '{}',
  tope_componente numeric,
  orden_evaluacion int not null,
  -- Obligatorio solo si tipo = 'pool_equipo'; sin default (§2.6).
  regla_reparto text check (regla_reparto in ('partes_iguales', 'ponderado_por_aporte', 'ponderado_por_dotacion', 'manual_aprobado')),
  created_at timestamptz default now(),
  constraint pool_equipo_exige_regla_reparto
    check (tipo <> 'pool_equipo' or regla_reparto is not null)
);

-- destino_tipo/destino_id son polimórficos (comisionado o nodo): sin FK nativa
-- por fila; la referencia se valida en la aplicación (fn_asignacion_destino_valido).
create table public.asignaciones_plan (
  id uuid primary key default uuid_generate_v4(),
  plantilla_id uuid not null references public.plantillas_plan(id) on delete cascade,
  destino_tipo text not null check (destino_tipo in ('comisionado', 'nodo')),
  destino_id uuid not null,
  vigencia_desde date not null,
  vigencia_hasta date,
  prioridad int not null default 0,
  created_at timestamptz default now()
);

create table public.overrides_plan (
  id uuid primary key default uuid_generate_v4(),
  asignacion_id uuid not null references public.asignaciones_plan(id) on delete cascade,
  parametro text not null,
  valor jsonb not null,
  vigencia_desde date not null,
  vigencia_hasta date,
  motivo text not null,
  aprobado_por text not null,
  aprobado_en timestamptz not null,
  created_at timestamptz default now(),
  constraint motivo_override_no_trivial check (char_length(motivo) >= 20)
);

-- -----------------------------------------------------------------------------
-- §2.7 — Meta. Nunca se edita: se versiona.
-- -----------------------------------------------------------------------------
create table public.metas (
  id_meta uuid primary key default uuid_generate_v4(),
  -- No está en el texto literal de §2.7 (que solo lista destino/periodo/...);
  -- se agrega para poder acotar la meta a una sociedad en RLS y en consultas,
  -- igual que sociedad_id en plantillas_plan.
  sociedad_id uuid not null references public.sociedades(id_sociedad),
  serie_id uuid not null default uuid_generate_v4(),
  destino_tipo text not null check (destino_tipo in ('comisionado', 'nodo')),
  destino_id uuid not null,
  periodo text not null,
  magnitud numeric not null,
  unidad text not null,
  version int not null default 1,
  motivo_version text,
  cargada_por text not null,
  aprobada_por text,
  aprobada_en timestamptz,
  estado text not null default 'borrador' check (estado in ('borrador', 'en_aprobacion', 'vigente', 'superada')),
  created_at timestamptz default now(),
  constraint motivo_version_desde_v2 check (version = 1 or motivo_version is not null)
);

-- -----------------------------------------------------------------------------
-- §2.8 — Campaña.
-- -----------------------------------------------------------------------------
create table public.campanas (
  id_campana uuid primary key default uuid_generate_v4(),
  sociedad_id uuid not null references public.sociedades(id_sociedad),
  concepto_codigo text not null references public.conceptos(codigo),
  condicion jsonb not null,
  multiplicador numeric,
  monto numeric,
  vigencia_hecho_desde date not null,
  vigencia_hecho_hasta date not null,
  fecha_publicacion date,
  -- Enum cerrado, no texto libre (§2.8 regla 1).
  alcance_retroactivo text not null check (alcance_retroactivo in ('desde_publicacion', 'todo_el_periodo_abierto')),
  presupuesto_estimado numeric,
  presupuesto_tope numeric not null,
  autorizador text,
  nivel_autorizacion text,
  autorizado_en timestamptz,
  estado text not null default 'borrador' check (estado in ('borrador', 'autorizada', 'publicada', 'cerrada', 'anulada')),
  created_at timestamptz default now(),
  constraint multiplicador_o_monto check (multiplicador is not null or monto is not null),
  -- Regla 3 (§2.8): no autorizada no se publica.
  constraint publicada_exige_autorizacion
    check (estado <> 'publicada' or (autorizador is not null and autorizado_en is not null)),
  constraint autorizada_exige_evidencia
    check (estado not in ('autorizada', 'publicada') or (autorizador is not null and nivel_autorizacion is not null and autorizado_en is not null))
);

-- -----------------------------------------------------------------------------
-- §2.9 / §2.10 — Fuente, transacción comisionable, splits y cuarentena.
-- -----------------------------------------------------------------------------
create table public.fuentes (
  id_fuente uuid primary key default uuid_generate_v4(),
  sociedad_id uuid not null references public.sociedades(id_sociedad),
  sistema text not null,
  modo text not null check (modo in ('api', 'archivo', 'manual')),
  mapeo_campos jsonb not null default '{}',
  politica_duplicados text not null check (politica_duplicados in ('rechazar', 'actualizar', 'versionar')),
  ventana_aceptacion_dias int not null default 90,
  created_at timestamptz default now()
);

create table public.transacciones (
  id_transaccion uuid primary key default uuid_generate_v4(),
  id_externo text,
  fuente_id uuid not null references public.fuentes(id_fuente),
  sociedad_id uuid not null references public.sociedades(id_sociedad),
  pais text not null references public.paises(codigo_pais),
  fecha_hecho date not null,
  fecha_credito date,
  tipo_evento text not null check (tipo_evento in ('firma', 'despacho', 'factura', 'cobro', 'nota_credito')),
  cliente text,
  producto text,
  canal text,
  territorio text,
  monto_bruto numeric not null,
  monto_neto numeric,
  margen numeric,
  unidades numeric,
  moneda text not null,
  estado text not null default 'valida' check (estado in ('valida', 'anulada', 'en_revision')),
  hash_origen text not null,
  clave_natural text not null,
  created_at timestamptz default now(),
  unique (fuente_id, clave_natural),
  -- §3.4 — Chile bloquea el evento de devengo "cobro" también a nivel de transacción.
  constraint cl_bloquea_evento_cobro
    check (not (pais = 'CL' and tipo_evento = 'cobro'))
);

create table public.transaccion_splits (
  id uuid primary key default uuid_generate_v4(),
  transaccion_id uuid not null references public.transacciones(id_transaccion) on delete cascade,
  comisionado_id uuid not null references public.comisionados(id_comisionado),
  porcentaje numeric not null check (porcentaje > 0 and porcentaje <= 100)
);

-- Suma de splits = 100%: verificado en la aplicación al ingestar (todos los
-- splits de una transacción se insertan en una sola operación) y re-verificado
-- aquí como red de seguridad antes de que una transacción cuente en el cierre.
create or replace function public.fn_verificar_splits_100(p_transaccion uuid)
returns boolean as $$
  select coalesce(sum(porcentaje), 0) = 100
  from public.transaccion_splits where transaccion_id = p_transaccion;
$$ language sql stable;

create table public.transacciones_cuarentena (
  id uuid primary key default uuid_generate_v4(),
  fuente_id uuid not null references public.fuentes(id_fuente),
  payload jsonb not null,
  motivo text not null,
  resuelto boolean not null default false,
  resuelto_por text,
  resuelto_en timestamptz,
  created_at timestamptz default now()
);

-- -----------------------------------------------------------------------------
-- §3.2 — Crédito. Unidad atómica de atribución.
-- -----------------------------------------------------------------------------
create table public.creditos (
  id_credito uuid primary key default uuid_generate_v4(),
  transaccion_id uuid not null references public.transacciones(id_transaccion),
  comisionado_id uuid not null references public.comisionados(id_comisionado),
  porcentaje_split numeric not null,
  monto_atribuido numeric not null,
  fecha_credito date not null,
  nodo_id uuid references public.nodos_jerarquia(id_nodo),
  snapshot_jerarquia jsonb not null,
  created_at timestamptz default now()
);

-- -----------------------------------------------------------------------------
-- §2.11 / §3.6 — Calendarios de período y tipo de cambio.
-- -----------------------------------------------------------------------------
create table public.periodos (
  id uuid primary key default uuid_generate_v4(),
  sociedad_id uuid not null references public.sociedades(id_sociedad),
  periodo text not null, -- yyyy-mm
  fecha_apertura date not null,
  fecha_corte date not null,
  estado text not null default 'abierto' check (estado in ('abierto', 'en_calculo', 'congelado', 'cerrado')),
  congelado_en timestamptz,
  congelado_hash text,
  cerrado_en timestamptz,
  cerrado_por text,
  created_at timestamptz default now(),
  unique (sociedad_id, periodo)
);

create table public.tipos_cambio (
  id uuid primary key default uuid_generate_v4(),
  moneda_origen text not null,
  moneda_destino text not null,
  periodo text not null,
  tasa numeric not null,
  fuente text not null,
  fecha date not null,
  created_at timestamptz default now(),
  unique (moneda_origen, moneda_destino, periodo)
);

-- -----------------------------------------------------------------------------
-- §3.3 — Resultado de cálculo (snapshot). Precede al movimiento de devengo.
-- -----------------------------------------------------------------------------
create table public.resultados_calculo (
  id_resultado uuid primary key default uuid_generate_v4(),
  periodo_id uuid not null references public.periodos(id),
  comisionado_id uuid not null references public.comisionados(id_comisionado),
  sociedad_id uuid not null references public.sociedades(id_sociedad),
  concepto_codigo text not null references public.conceptos(codigo),
  plantilla_id uuid not null references public.plantillas_plan(id),
  componente_id uuid references public.componentes_plan(id),
  importe numeric not null,
  moneda text not null,
  detalle_diario jsonb,
  -- Versión de plantilla, asignación, override, meta, jerarquía, campaña,
  -- tipo de cambio y lista de créditos que componen el resultado (§3.3).
  snapshot jsonb not null,
  estado text not null default 'preliminar' check (estado in ('preliminar', 'congelado')),
  id_movimiento uuid references public.movimientos_devengo(id_movimiento),
  created_at timestamptz default now()
);

-- -----------------------------------------------------------------------------
-- RLS — límite de tenant por sociedad. Simplificación declarada: `comisionados`
-- y `creditos`/`transaccion_splits` heredan la visibilidad de sus filas padre
-- (transacción / comisionado_sociedad) en vez de tener su propia política
-- rol-por-rol; endurecer por rol es trabajo de Fase 2 (gobierno).
-- -----------------------------------------------------------------------------
alter table public.sociedades enable row level security;
alter table public.usuario_rol_sociedad enable row level security;
alter table public.comisionados enable row level security;
alter table public.comisionado_sociedad enable row level security;
alter table public.nodos_jerarquia enable row level security;
alter table public.plantillas_plan enable row level security;
alter table public.componentes_plan enable row level security;
alter table public.asignaciones_plan enable row level security;
alter table public.overrides_plan enable row level security;
alter table public.metas enable row level security;
alter table public.campanas enable row level security;
alter table public.fuentes enable row level security;
alter table public.transacciones enable row level security;
alter table public.transaccion_splits enable row level security;
alter table public.transacciones_cuarentena enable row level security;
alter table public.creditos enable row level security;
alter table public.periodos enable row level security;
alter table public.resultados_calculo enable row level security;

create policy "Miembros ven su sociedad" on public.sociedades for select
  using (public.es_miembro_sociedad(id_sociedad));
create policy "Cualquier usuario autenticado crea una sociedad" on public.sociedades for insert
  with check (auth.uid() = creado_por);

create policy "Miembros ven roles de su sociedad" on public.usuario_rol_sociedad for select
  using (public.es_miembro_sociedad(sociedad_id));
create policy "Admin gestiona roles" on public.usuario_rol_sociedad for all
  using (public.tiene_rol_en_sociedad(sociedad_id, array['admin']::public.rol_sociedad[]));

create policy "Miembros ven comisionados vinculados a su sociedad" on public.comisionados for select
  using (exists (
    select 1 from public.comisionado_sociedad cs
    where cs.comisionado_id = comisionados.id_comisionado and public.es_miembro_sociedad(cs.sociedad_id)
  ));
create policy "Miembros crean comisionados" on public.comisionados for insert
  with check (true);

create policy "Miembros ven vínculos de su sociedad" on public.comisionado_sociedad for all
  using (public.es_miembro_sociedad(sociedad_id));

create policy "Miembros ven jerarquía de su sociedad" on public.nodos_jerarquia for select
  using (public.es_miembro_sociedad(sociedad_id));
create policy "Admin y dueño comercial gestionan jerarquía" on public.nodos_jerarquia for insert
  with check (public.tiene_rol_en_sociedad(sociedad_id, array['admin', 'dueño_comercial']::public.rol_sociedad[]));
create policy "Admin y dueño comercial actualizan jerarquía" on public.nodos_jerarquia for update
  using (public.tiene_rol_en_sociedad(sociedad_id, array['admin', 'dueño_comercial']::public.rol_sociedad[]));

create policy "Miembros ven plantillas de su sociedad" on public.plantillas_plan for select
  using (public.es_miembro_sociedad(sociedad_id));
create policy "Diseñador de planes crea plantillas" on public.plantillas_plan for insert
  with check (public.tiene_rol_en_sociedad(sociedad_id, array['admin', 'disenador_planes']::public.rol_sociedad[]));
create policy "Dueño comercial y control de gestión aprueban plantillas" on public.plantillas_plan for update
  using (public.tiene_rol_en_sociedad(sociedad_id, array['admin', 'dueño_comercial', 'control_gestion', 'disenador_planes']::public.rol_sociedad[]));

create policy "Miembros ven componentes vía plantilla" on public.componentes_plan for all
  using (exists (select 1 from public.plantillas_plan p where p.id = componentes_plan.plantilla_id and public.es_miembro_sociedad(p.sociedad_id)));
create policy "Miembros ven asignaciones vía plantilla" on public.asignaciones_plan for all
  using (exists (select 1 from public.plantillas_plan p where p.id = asignaciones_plan.plantilla_id and public.es_miembro_sociedad(p.sociedad_id)));
create policy "Miembros ven overrides vía asignación" on public.overrides_plan for all
  using (exists (
    select 1 from public.asignaciones_plan a join public.plantillas_plan p on p.id = a.plantilla_id
    where a.id = overrides_plan.asignacion_id and public.es_miembro_sociedad(p.sociedad_id)
  ));

create policy "Miembros ven metas de su sociedad" on public.metas for select
  using (public.es_miembro_sociedad(sociedad_id));
create policy "Carga metas inserta" on public.metas for insert
  with check (public.tiene_rol_en_sociedad(sociedad_id, array['admin', 'carga_metas']::public.rol_sociedad[]));
create policy "Aprueba metas actualiza — nunca quien la cargó (§4.4)" on public.metas for update
  using (public.tiene_rol_en_sociedad(sociedad_id, array['admin', 'aprueba_metas']::public.rol_sociedad[]));

create policy "Miembros ven campañas de su sociedad" on public.campanas for select
  using (public.es_miembro_sociedad(sociedad_id));
create policy "Dueño comercial crea campañas" on public.campanas for insert
  with check (public.tiene_rol_en_sociedad(sociedad_id, array['admin', 'dueño_comercial']::public.rol_sociedad[]));
create policy "Autoriza campañas actualiza" on public.campanas for update
  using (public.tiene_rol_en_sociedad(sociedad_id, array['admin', 'autoriza_campanas', 'dueño_comercial']::public.rol_sociedad[]));

create policy "Miembros ven fuentes de su sociedad" on public.fuentes for all
  using (public.es_miembro_sociedad(sociedad_id));

create policy "Miembros ven transacciones de su sociedad" on public.transacciones for select
  using (public.es_miembro_sociedad(sociedad_id));
create policy "Miembros ingestan transacciones" on public.transacciones for insert
  with check (public.es_miembro_sociedad(sociedad_id));

create policy "Miembros ven splits vía transacción" on public.transaccion_splits for all
  using (exists (select 1 from public.transacciones t where t.id_transaccion = transaccion_splits.transaccion_id and public.es_miembro_sociedad(t.sociedad_id)));

create policy "Miembros ven cuarentena vía fuente" on public.transacciones_cuarentena for all
  using (exists (select 1 from public.fuentes f where f.id_fuente = transacciones_cuarentena.fuente_id and public.es_miembro_sociedad(f.sociedad_id)));

create policy "Miembros ven créditos vía transacción" on public.creditos for select
  using (exists (select 1 from public.transacciones t where t.id_transaccion = creditos.transaccion_id and public.es_miembro_sociedad(t.sociedad_id)));

create policy "Miembros ven períodos de su sociedad" on public.periodos for select
  using (public.es_miembro_sociedad(sociedad_id));
create policy "Jefatura comercial y control cierran períodos" on public.periodos for update
  using (public.tiene_rol_en_sociedad(sociedad_id, array['admin', 'jefatura_comercial', 'control_gestion']::public.rol_sociedad[]));

create policy "Miembros ven resultados de su sociedad" on public.resultados_calculo for select
  using (public.es_miembro_sociedad(sociedad_id));
