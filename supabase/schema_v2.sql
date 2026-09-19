-- Devenga v2 — Schema completo
-- Reemplaza: schema.sql + seed_fase0.sql + schema_fase1-3.sql + schema_fixes_2026_09.sql
-- Aplicar sobre un proyecto Supabase limpio (reset previo de datos).
-- Países catálogo y matriz legal se siembran en seed_v2.sql.

-- ============================================================
-- GLOBAL — Catálogos del motor (sin tenant)
-- ============================================================

create table paises (
  codigo_pais text primary key,
  nombre text not null,
  moneda_funcional text not null,
  regimen_legal_version text not null default '1.0',
  estado text not null default 'activo' check (estado in ('activo','en_implementacion','congelado'))
);
alter table paises enable row level security;
create policy "paises_lectura" on paises for select using (true);

create table matriz_legal_pais (
  id uuid primary key default gen_random_uuid(),
  codigo_pais text not null references paises(codigo_pais),
  concepto_tipo text not null,
  evento_devengo text not null,
  devengo_diario boolean not null default false,
  confianza text not null check (confianza in ('seguro','probable','suposicion')),
  notas text
);
alter table matriz_legal_pais enable row level security;
create policy "matriz_lectura" on matriz_legal_pais for select using (true);

create table matriz_legal_incidencia (
  id uuid primary key default gen_random_uuid(),
  matriz_id uuid not null references matriz_legal_pais(id) on delete cascade,
  incidencia text not null
);
alter table matriz_legal_incidencia enable row level security;
create policy "incidencia_lectura" on matriz_legal_incidencia for select using (true);

create table tipos_cambio (
  id uuid primary key default gen_random_uuid(),
  moneda_origen text not null,
  moneda_destino text not null,
  periodo text not null,
  tasa numeric not null,
  created_at timestamptz not null default now(),
  unique (moneda_origen, moneda_destino, periodo)
);
alter table tipos_cambio enable row level security;
create policy "tipos_cambio_lectura" on tipos_cambio for select using (true);

create table puertas_aprobacion (
  numero integer primary key,
  nombre text not null,
  descripcion text
);
alter table puertas_aprobacion enable row level security;
create policy "puertas_lectura" on puertas_aprobacion for select using (true);

create table controles_bloqueantes (
  numero integer primary key,
  nombre text not null,
  descripcion text
);
alter table controles_bloqueantes enable row level security;
create policy "controles_lectura" on controles_bloqueantes for select using (true);

create table segregacion_funciones (
  id uuid primary key default gen_random_uuid(),
  rol_que_no_puede text not null,
  accion_bloqueada text not null,
  motivo text
);
alter table segregacion_funciones enable row level security;
create policy "segregacion_lectura" on segregacion_funciones for select using (true);

-- ============================================================
-- USUARIOS (globales — sin scope de tenant)
-- ============================================================

create table usuarios_app (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  email text not null,
  created_at timestamptz not null default now()
);
alter table usuarios_app enable row level security;
create policy "usuario_ve_su_perfil" on usuarios_app for select using (auth.uid() = id);
create policy "usuario_inserta_su_perfil" on usuarios_app for insert with check (auth.uid() = id);
create policy "usuario_actualiza_su_perfil" on usuarios_app for update using (auth.uid() = id);

-- ============================================================
-- TENANTS
-- ============================================================

create table tenants (
  id_tenant uuid primary key default gen_random_uuid(),
  nombre_comercial text not null,
  dominio_personalizado text unique,
  logo_principal text,
  logo_reducido text,
  color_primario text not null default '#7c3aed',
  color_secundario text not null default '#6d28d9',
  color_acento text not null default '#a78bfa',
  tipografia text,
  paleta_email jsonb,
  pie_legal_email text,
  terminos_uso_url text,
  politica_privacidad_url text,
  estado text not null default 'en_configuracion'
    check (estado in ('en_configuracion','activo','suspendido','baja')),
  fecha_activacion date,
  pais_base text not null references paises(codigo_pais),
  zona_horaria text not null default 'America/Santiago',
  created_at timestamptz not null default now()
);
alter table tenants enable row level security;

-- ============================================================
-- RBAC — Membresía y roles
-- ============================================================

create type rol_base_tenant as enum ('administrador','jefe','comisionado');

create table usuario_tenant (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid not null references tenants(id_tenant) on delete cascade,
  rol_base rol_base_tenant not null default 'administrador',
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (usuario_id, tenant_id)
);
alter table usuario_tenant enable row level security;

-- Permisos operacionales dentro de una sociedad
create type permiso_operacional as enum (
  'admin_sociedad',
  'carga_metas',
  'aprueba_metas',
  'disenador_planes',
  'aprobador_planes',
  'ingesta_transacciones',
  'cierre_periodo',
  'aprobador_campanas',
  'jefatura_comercial'
);

create table usuario_permiso_sociedad (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  sociedad_id uuid not null,  -- FK añadida tras crear sociedades
  permiso permiso_operacional not null,
  created_at timestamptz not null default now(),
  unique (usuario_id, sociedad_id, permiso)
);
alter table usuario_permiso_sociedad enable row level security;

-- Scope del Jefe — nodo raíz y descendientes visibles
create table jefe_nodo (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid not null references tenants(id_tenant) on delete cascade,
  nodo_id uuid not null,  -- FK añadida tras crear nodos_jerarquia
  desde date not null,
  hasta date,
  created_at timestamptz not null default now()
);
alter table jefe_nodo enable row level security;

-- ============================================================
-- HELPER FUNCTIONS (definen RLS antes de usarlas)
-- ============================================================

create or replace function es_miembro_tenant(p_tenant uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from usuario_tenant
    where usuario_id = auth.uid()
      and tenant_id = p_tenant
      and activo = true
  )
$$;

create or replace function tiene_rol_base(p_tenant uuid, p_roles text[])
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from usuario_tenant
    where usuario_id = auth.uid()
      and tenant_id = p_tenant
      and activo = true
      and rol_base::text = any(p_roles)
  )
$$;

-- Admin del tenant tiene acceso implícito a todas sus sociedades
create or replace function es_miembro_sociedad(p_sociedad uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from usuario_tenant ut
    join sociedades s on s.tenant_id = ut.tenant_id
    where s.id_sociedad = p_sociedad
      and ut.usuario_id = auth.uid()
      and ut.activo = true
      and ut.rol_base = 'administrador'
  ) or exists (
    select 1 from usuario_permiso_sociedad
    where usuario_id = auth.uid() and sociedad_id = p_sociedad
  )
$$;

-- Admin tiene todos los permisos operacionales implícitamente
create or replace function tiene_permiso_en_sociedad(p_sociedad uuid, p_permisos permiso_operacional[])
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from usuario_tenant ut
    join sociedades s on s.tenant_id = ut.tenant_id
    where s.id_sociedad = p_sociedad
      and ut.usuario_id = auth.uid()
      and ut.activo = true
      and ut.rol_base = 'administrador'
  ) or exists (
    select 1 from usuario_permiso_sociedad
    where usuario_id = auth.uid()
      and sociedad_id = p_sociedad
      and permiso = any(p_permisos)
  )
$$;

-- ============================================================
-- CONCEPTOS (por-tenant en v2)
-- ============================================================

create table conceptos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id_tenant) on delete cascade,
  pais text not null references paises(codigo_pais),
  codigo text not null,
  nombre text not null,
  tipo text not null,
  devengo_diario boolean not null default false,
  evento_devengo text not null,
  incide_en text[] not null default '{}',
  tope_concepto numeric,
  vigencia_desde date not null,
  vigencia_hasta date,
  principalidad text not null default 'principal'
    check (principalidad in ('principal','accesorio')),
  ordinariedad text not null default 'ordinario'
    check (ordinariedad in ('ordinario','extraordinario')),
  created_at timestamptz not null default now(),
  unique (tenant_id, pais, codigo)
);

create or replace function fn_concepto_incide_en_no_vacio()
returns trigger language plpgsql as $$
begin
  if array_length(new.incide_en, 1) is null or array_length(new.incide_en, 1) = 0 then
    raise exception 'incide_en no puede estar vacío';
  end if;
  return new;
end;
$$;
create trigger tg_concepto_incide_en
  before insert or update on conceptos
  for each row execute function fn_concepto_incide_en_no_vacio();

alter table conceptos enable row level security;
create policy "conceptos_lectura" on conceptos for select using (es_miembro_tenant(tenant_id));
create policy "conceptos_insert" on conceptos for insert with check (tiene_rol_base(tenant_id, array['administrador']));
create policy "conceptos_update" on conceptos for update using (tiene_rol_base(tenant_id, array['administrador']));

-- ============================================================
-- SOCIEDADES
-- ============================================================

create table sociedades (
  id_sociedad uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id_tenant) on delete cascade,
  pais text not null references paises(codigo_pais),
  nombre text not null,
  identificador_fiscal text,
  sistema_nomina text,
  modo_integracion text not null default 'manual'
    check (modo_integracion in ('api','archivo','manual')),
  created_at timestamptz not null default now(),
  unique (tenant_id, pais, identificador_fiscal)
);

-- FK diferidas que referencian sociedades
alter table usuario_permiso_sociedad
  add constraint fk_ups_sociedad
  foreign key (sociedad_id) references sociedades(id_sociedad) on delete cascade;

-- Trigger: al crear una sociedad, asignar admin_sociedad al creador
create or replace function fn_alta_admin_sociedad()
returns trigger language plpgsql security definer as $$
begin
  insert into usuario_permiso_sociedad (usuario_id, sociedad_id, permiso)
  values (auth.uid(), new.id_sociedad, 'admin_sociedad')
  on conflict do nothing;
  return new;
end;
$$;
create trigger tg_alta_admin_sociedad
  after insert on sociedades
  for each row execute function fn_alta_admin_sociedad();

alter table sociedades enable row level security;
create policy "sociedades_lectura" on sociedades for select using (es_miembro_tenant(tenant_id));
create policy "sociedades_insert" on sociedades for insert
  with check (es_miembro_tenant(tenant_id) and tiene_rol_base(tenant_id, array['administrador']));
create policy "sociedades_update" on sociedades for update
  using (tiene_rol_base(tenant_id, array['administrador']));

-- RLS de tenants (ahora que las funciones helper existen)
create policy "tenants_lectura" on tenants for select using (es_miembro_tenant(id_tenant));
create policy "tenants_update" on tenants for update using (tiene_rol_base(id_tenant, array['administrador']));

-- RLS de usuario_tenant
create policy "ut_lectura" on usuario_tenant for select using (es_miembro_tenant(tenant_id));
create policy "ut_insert" on usuario_tenant for insert
  with check (tiene_rol_base(tenant_id, array['administrador']));
create policy "ut_update" on usuario_tenant for update
  using (tiene_rol_base(tenant_id, array['administrador']));

-- RLS de usuario_permiso_sociedad
create policy "ups_lectura" on usuario_permiso_sociedad for select
  using (exists (
    select 1 from sociedades s
    join usuario_tenant ut on ut.tenant_id = s.tenant_id
    where s.id_sociedad = sociedad_id and ut.usuario_id = auth.uid() and ut.activo = true
  ));
create policy "ups_insert" on usuario_permiso_sociedad for insert
  with check (es_miembro_sociedad(sociedad_id));
create policy "ups_delete" on usuario_permiso_sociedad for delete
  using (es_miembro_sociedad(sociedad_id));

-- ============================================================
-- COMISIONADOS
-- ============================================================

create table comisionados (
  id_comisionado uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id_tenant) on delete cascade,
  pais text not null references paises(codigo_pais),
  identificador_personal text not null,
  tipo text not null check (tipo in ('dependiente','no_dependiente')),
  vigencia_desde date not null,
  usuario_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (tenant_id, pais, identificador_personal)
);

create table comisionado_sociedad (
  id uuid primary key default gen_random_uuid(),
  comisionado_id uuid not null references comisionados(id_comisionado) on delete cascade,
  sociedad_id uuid not null references sociedades(id_sociedad) on delete cascade,
  desde date not null,
  hasta date,
  id_en_nomina text,
  centro_costo text,
  rol_comercial text,
  created_at timestamptz not null default now(),
  unique (comisionado_id, sociedad_id, desde)
);

alter table comisionados enable row level security;
create policy "comisionados_lectura_staff" on comisionados for select using (es_miembro_tenant(tenant_id));
create policy "comisionados_insert" on comisionados for insert with check (es_miembro_tenant(tenant_id));
create policy "comisionados_update" on comisionados for update using (es_miembro_tenant(tenant_id));
create policy "comisionados_lectura_portal" on comisionados for select using (usuario_id = auth.uid());

alter table comisionado_sociedad enable row level security;
create policy "cs_lectura" on comisionado_sociedad for select
  using (exists (select 1 from comisionados c where c.id_comisionado = comisionado_id and es_miembro_tenant(c.tenant_id)));
create policy "cs_insert" on comisionado_sociedad for insert with check (es_miembro_sociedad(sociedad_id));
create policy "cs_update" on comisionado_sociedad for update using (es_miembro_sociedad(sociedad_id));

-- ============================================================
-- JERARQUÍA
-- ============================================================

create table nodos_jerarquia (
  id_nodo uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id_tenant) on delete cascade,
  sociedad_id uuid not null references sociedades(id_sociedad) on delete cascade,
  nombre text not null,
  nodo_padre uuid references nodos_jerarquia(id_nodo),
  created_at timestamptz not null default now()
);

alter table jefe_nodo
  add constraint fk_jn_nodo foreign key (nodo_id) references nodos_jerarquia(id_nodo) on delete cascade;

alter table nodos_jerarquia enable row level security;
create policy "nodos_lectura" on nodos_jerarquia for select using (es_miembro_tenant(tenant_id));
create policy "nodos_insert" on nodos_jerarquia for insert with check (es_miembro_tenant(tenant_id));
create policy "nodos_update" on nodos_jerarquia for update using (es_miembro_tenant(tenant_id));

alter table jefe_nodo enable row level security;
create policy "jn_lectura" on jefe_nodo for select using (es_miembro_tenant(tenant_id));
create policy "jn_insert" on jefe_nodo for insert
  with check (tiene_rol_base(tenant_id, array['administrador']));

-- ============================================================
-- PLANES
-- ============================================================

create table plantillas_plan (
  id_plantilla uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id_tenant) on delete cascade,
  sociedad_id uuid not null references sociedades(id_sociedad) on delete cascade,
  pais text not null references paises(codigo_pais),
  nombre text not null,
  version integer not null default 1,
  estado text not null default 'borrador'
    check (estado in ('borrador','aprobado','vigente','archivado')),
  aprobado_por uuid references auth.users(id),
  aprobado_en timestamptz,
  created_at timestamptz not null default now()
);

create table componentes_plan (
  id_componente uuid primary key default gen_random_uuid(),
  plantilla_id uuid not null references plantillas_plan(id_plantilla) on delete cascade,
  concepto_codigo text not null,
  tipo_calculo text not null
    check (tipo_calculo in ('tasa_lineal','tramos','fijo','pool_equipo')),
  parametros jsonb not null default '{}',
  tope_componente numeric,
  orden integer not null default 0,
  created_at timestamptz not null default now()
);

create table asignaciones_plan (
  id_asignacion uuid primary key default gen_random_uuid(),
  plantilla_id uuid not null references plantillas_plan(id_plantilla) on delete cascade,
  comisionado_id uuid not null references comisionados(id_comisionado) on delete cascade,
  vigencia_desde date not null,
  vigencia_hasta date,
  created_at timestamptz not null default now()
);

create table overrides_plan (
  id_override uuid primary key default gen_random_uuid(),
  asignacion_id uuid not null references asignaciones_plan(id_asignacion) on delete cascade,
  campo text not null,
  valor_nuevo jsonb not null,
  motivo text not null,
  aprobado_por uuid references auth.users(id),
  vigencia_desde date not null,
  vigencia_hasta date,
  created_at timestamptz not null default now()
);

alter table plantillas_plan enable row level security;
create policy "pp_lectura" on plantillas_plan for select using (es_miembro_tenant(tenant_id));
create policy "pp_insert" on plantillas_plan for insert with check (es_miembro_sociedad(sociedad_id));
create policy "pp_update" on plantillas_plan for update
  using (tiene_permiso_en_sociedad(sociedad_id, array['disenador_planes','aprobador_planes']::permiso_operacional[]));

alter table componentes_plan enable row level security;
create policy "cp_lectura" on componentes_plan for select
  using (exists (select 1 from plantillas_plan p where p.id_plantilla = plantilla_id and es_miembro_tenant(p.tenant_id)));
create policy "cp_insert" on componentes_plan for insert
  with check (exists (select 1 from plantillas_plan p where p.id_plantilla = plantilla_id and es_miembro_tenant(p.tenant_id)));
create policy "cp_update" on componentes_plan for update
  using (exists (select 1 from plantillas_plan p where p.id_plantilla = plantilla_id and es_miembro_tenant(p.tenant_id)));

alter table asignaciones_plan enable row level security;
create policy "ap_lectura" on asignaciones_plan for select
  using (exists (select 1 from plantillas_plan p where p.id_plantilla = plantilla_id and es_miembro_tenant(p.tenant_id)));
create policy "ap_insert" on asignaciones_plan for insert
  with check (exists (select 1 from plantillas_plan p where p.id_plantilla = plantilla_id and es_miembro_tenant(p.tenant_id)));

alter table overrides_plan enable row level security;
create policy "op_lectura" on overrides_plan for select
  using (exists (
    select 1 from asignaciones_plan a
    join plantillas_plan p on p.id_plantilla = a.plantilla_id
    where a.id_asignacion = asignacion_id and es_miembro_tenant(p.tenant_id)
  ));
create policy "op_insert" on overrides_plan for insert
  with check (exists (
    select 1 from asignaciones_plan a
    join plantillas_plan p on p.id_plantilla = a.plantilla_id
    where a.id_asignacion = asignacion_id and es_miembro_tenant(p.tenant_id)
  ));

-- ============================================================
-- METAS
-- ============================================================

create table metas (
  id_meta uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id_tenant) on delete cascade,
  sociedad_id uuid not null references sociedades(id_sociedad) on delete cascade,
  concepto_codigo text not null,
  pais text not null references paises(codigo_pais),
  periodo text not null,
  destino_tipo text not null check (destino_tipo in ('comisionado','nodo')),
  destino_id uuid not null,
  magnitud numeric not null,
  unidad text not null default 'CLP',
  estado text not null default 'borrador'
    check (estado in ('borrador','en_aprobacion','vigente','superada')),
  version integer not null default 1,
  motivo_version text,
  cargada_por uuid references auth.users(id),
  aprobada_por uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create or replace function fn_superar_versiones_anteriores()
returns trigger language plpgsql as $$
begin
  if new.estado = 'vigente' then
    update metas set estado = 'superada'
    where sociedad_id = new.sociedad_id
      and concepto_codigo = new.concepto_codigo
      and periodo = new.periodo
      and destino_id = new.destino_id
      and id_meta <> new.id_meta
      and estado in ('borrador','en_aprobacion','vigente');
  end if;
  return new;
end;
$$;
create trigger tg_superar_versiones
  after update on metas
  for each row when (new.estado = 'vigente')
  execute function fn_superar_versiones_anteriores();

alter table metas enable row level security;
create policy "metas_lectura_staff" on metas for select using (es_miembro_tenant(tenant_id));
create policy "metas_insert" on metas for insert
  with check (tiene_permiso_en_sociedad(sociedad_id, array['carga_metas']::permiso_operacional[]));
create policy "metas_update_carga" on metas for update
  using (tiene_permiso_en_sociedad(sociedad_id, array['carga_metas']::permiso_operacional[]))
  with check (estado = 'en_aprobacion');
create policy "metas_update_aprueba" on metas for update
  using (tiene_permiso_en_sociedad(sociedad_id, array['aprueba_metas']::permiso_operacional[]))
  with check (estado in ('vigente','superada'));
-- Portal: comisionado ve sus metas
create policy "metas_lectura_portal" on metas for select
  using (destino_tipo = 'comisionado' and exists (
    select 1 from comisionados c where c.id_comisionado = destino_id and c.usuario_id = auth.uid()
  ));

-- ============================================================
-- CAMPAÑAS
-- ============================================================

create table campanas (
  id_campana uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id_tenant) on delete cascade,
  sociedad_id uuid not null references sociedades(id_sociedad) on delete cascade,
  concepto_codigo text not null,
  nombre text not null,
  tipo text not null check (tipo in ('multiplicador','monto_adicional')),
  multiplicador numeric,
  monto numeric,
  vigencia_hecho_desde date not null,
  vigencia_hecho_hasta date not null,
  alcance_retroactivo boolean not null default false,
  presupuesto_tope numeric,
  estado text not null default 'borrador'
    check (estado in ('borrador','autorizada','publicada','vencida')),
  autorizado_por uuid references auth.users(id),
  autorizado_en timestamptz,
  publicado_en timestamptz,
  excepcion_presupuesto_motivo text,
  excepcion_presupuesto_autorizado_por uuid references auth.users(id),
  excepcion_presupuesto_en timestamptz,
  created_at timestamptz not null default now()
);

alter table campanas enable row level security;
create policy "campanas_lectura" on campanas for select using (es_miembro_tenant(tenant_id));
create policy "campanas_insert" on campanas for insert with check (es_miembro_sociedad(sociedad_id));
create policy "campanas_update" on campanas for update using (es_miembro_sociedad(sociedad_id));

-- ============================================================
-- FUENTES Y TRANSACCIONES
-- ============================================================

create table fuentes (
  id_fuente uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id_tenant) on delete cascade,
  sociedad_id uuid not null references sociedades(id_sociedad) on delete cascade,
  nombre text not null,
  sistema_origen text,
  mapeo_campos jsonb not null default '{}',
  activa boolean not null default true,
  created_at timestamptz not null default now()
);

create table transacciones (
  id_transaccion uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id_tenant) on delete cascade,
  sociedad_id uuid not null references sociedades(id_sociedad) on delete cascade,
  fuente_id uuid references fuentes(id_fuente),
  fecha_hecho date not null,
  fecha_credito date,
  producto text,
  canal text,
  tipo_evento text not null,
  monto numeric not null,
  moneda text not null default 'CLP',
  id_externo text,
  metadatos jsonb not null default '{}',
  estado text not null default 'pendiente'
    check (estado in ('pendiente','acreditada','cuarentena','anulada')),
  motivo_cuarentena text,
  anulada_en timestamptz,
  created_at timestamptz not null default now()
);

create table transaccion_splits (
  id uuid primary key default gen_random_uuid(),
  transaccion_id uuid not null references transacciones(id_transaccion) on delete cascade,
  comisionado_id uuid not null references comisionados(id_comisionado),
  porcentaje numeric not null check (porcentaje > 0 and porcentaje <= 100),
  created_at timestamptz not null default now()
);

create table transacciones_cuarentena (
  id uuid primary key default gen_random_uuid(),
  transaccion_id uuid not null references transacciones(id_transaccion) on delete cascade,
  fuente_id uuid references fuentes(id_fuente),
  motivo text not null,
  resuelta boolean not null default false,
  resuelta_en timestamptz,
  created_at timestamptz not null default now()
);

alter table fuentes enable row level security;
create policy "fuentes_lectura" on fuentes for select using (es_miembro_tenant(tenant_id));
create policy "fuentes_insert" on fuentes for insert with check (es_miembro_sociedad(sociedad_id));
create policy "fuentes_update" on fuentes for update using (es_miembro_sociedad(sociedad_id));

alter table transacciones enable row level security;
create policy "tx_lectura" on transacciones for select using (es_miembro_tenant(tenant_id));
create policy "tx_insert" on transacciones for insert
  with check (tiene_permiso_en_sociedad(sociedad_id, array['ingesta_transacciones']::permiso_operacional[]));
create policy "tx_update" on transacciones for update
  using (tiene_permiso_en_sociedad(sociedad_id, array['ingesta_transacciones']::permiso_operacional[]));

alter table transaccion_splits enable row level security;
create policy "ts_lectura" on transaccion_splits for select
  using (exists (select 1 from transacciones t where t.id_transaccion = transaccion_id and es_miembro_tenant(t.tenant_id)));
create policy "ts_insert" on transaccion_splits for insert
  with check (exists (select 1 from transacciones t where t.id_transaccion = transaccion_id and es_miembro_tenant(t.tenant_id)));

alter table transacciones_cuarentena enable row level security;
create policy "tc_lectura" on transacciones_cuarentena for select
  using (exists (select 1 from transacciones t where t.id_transaccion = transaccion_id and es_miembro_tenant(t.tenant_id)));
create policy "tc_insert" on transacciones_cuarentena for insert
  with check (exists (select 1 from transacciones t where t.id_transaccion = transaccion_id and es_miembro_tenant(t.tenant_id)));
create policy "tc_update" on transacciones_cuarentena for update
  using (exists (select 1 from transacciones t where t.id_transaccion = transaccion_id and es_miembro_tenant(t.tenant_id)));

-- ============================================================
-- PERÍODOS, CRÉDITOS Y RESULTADOS
-- ============================================================

create table periodos (
  id_periodo uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id_tenant) on delete cascade,
  sociedad_id uuid not null references sociedades(id_sociedad) on delete cascade,
  periodo text not null,
  estado text not null default 'abierto'
    check (estado in ('abierto','en_calculo','calculado','cerrado')),
  calculado_en timestamptz,
  cerrado_en timestamptz,
  movimientos_generados integer default 0,
  created_at timestamptz not null default now(),
  unique (sociedad_id, periodo)
);

create table creditos (
  id_credito uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id_tenant) on delete cascade,
  transaccion_id uuid not null references transacciones(id_transaccion),
  comisionado_id uuid not null references comisionados(id_comisionado),
  concepto_codigo text not null,
  fecha_credito date not null,
  monto_atribuido numeric not null,
  moneda text not null default 'CLP',
  porcentaje_atribuido numeric,
  snapshot_jerarquia jsonb,
  created_at timestamptz not null default now()
);

create table resultados_calculo (
  id_resultado uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id_tenant) on delete cascade,
  periodo_id uuid not null references periodos(id_periodo) on delete cascade,
  sociedad_id uuid not null references sociedades(id_sociedad),
  comisionado_id uuid not null references comisionados(id_comisionado),
  concepto_codigo text not null,
  importe numeric not null default 0,
  moneda text not null default 'CLP',
  detalle_diario jsonb,
  estado text not null default 'preliminar' check (estado in ('preliminar','congelado')),
  id_movimiento uuid,
  created_at timestamptz not null default now()
);

alter table periodos enable row level security;
create policy "periodos_lectura" on periodos for select using (es_miembro_tenant(tenant_id));
create policy "periodos_insert" on periodos for insert with check (es_miembro_sociedad(sociedad_id));
create policy "periodos_update" on periodos for update using (es_miembro_sociedad(sociedad_id));

alter table creditos enable row level security;
create policy "creditos_lectura_staff" on creditos for select using (es_miembro_tenant(tenant_id));
create policy "creditos_insert" on creditos for insert with check (es_miembro_tenant(tenant_id));
create policy "creditos_update" on creditos for update using (es_miembro_tenant(tenant_id));
create policy "creditos_delete" on creditos for delete using (es_miembro_tenant(tenant_id));
create policy "creditos_lectura_portal" on creditos for select
  using (exists (select 1 from comisionados c where c.id_comisionado = comisionado_id and c.usuario_id = auth.uid()));

alter table resultados_calculo enable row level security;
create policy "rc_lectura_staff" on resultados_calculo for select using (es_miembro_tenant(tenant_id));
create policy "rc_insert" on resultados_calculo for insert with check (es_miembro_tenant(tenant_id));
create policy "rc_update" on resultados_calculo for update using (es_miembro_tenant(tenant_id));
create policy "rc_delete" on resultados_calculo for delete using (es_miembro_tenant(tenant_id));
create policy "rc_lectura_portal" on resultados_calculo for select
  using (exists (select 1 from comisionados c where c.id_comisionado = comisionado_id and c.usuario_id = auth.uid()));

-- ============================================================
-- MOVIMIENTOS DE DEVENGO
-- ============================================================

create table movimientos_devengo (
  id_movimiento uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id_tenant) on delete cascade,
  sociedad uuid not null references sociedades(id_sociedad),
  comisionado uuid not null references comisionados(id_comisionado),
  concepto_codigo text not null,
  periodo_origen text not null,
  periodo_imputacion text not null,
  importe_bruto numeric not null,
  moneda text not null default 'CLP',
  principalidad text not null,
  ordinariedad text not null,
  devengo_diario boolean not null default false,
  detalle_diario jsonb,
  incide_en text[] not null default '{}',
  estado text not null default 'enviado_a_nomina'
    check (estado in ('enviado_a_nomina','acusado','pagado')),
  snapshot_reglas jsonb,
  snapshot_creditos jsonb,
  snapshot_aprobaciones jsonb,
  url_documento text,
  created_at timestamptz not null default now()
);

alter table movimientos_devengo enable row level security;
create policy "mv_lectura_staff" on movimientos_devengo for select using (es_miembro_tenant(tenant_id));
create policy "mv_insert" on movimientos_devengo for insert with check (es_miembro_tenant(tenant_id));
create policy "mv_update" on movimientos_devengo for update using (es_miembro_tenant(tenant_id));
create policy "mv_lectura_portal" on movimientos_devengo for select
  using (exists (select 1 from comisionados c where c.id_comisionado = comisionado and c.usuario_id = auth.uid()));

-- FK diferida: resultados_calculo → movimientos_devengo
alter table resultados_calculo
  add constraint fk_rc_movimiento
  foreign key (id_movimiento) references movimientos_devengo(id_movimiento);

-- ============================================================
-- ACUSES DE NÓMINA
-- ============================================================

create table acuses_nomina (
  id_acuse uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id_tenant) on delete cascade,
  movimiento_id uuid not null references movimientos_devengo(id_movimiento),
  fecha_acuse timestamptz not null default now(),
  monto_bruto_pagado numeric not null,
  periodo_nomina text not null,
  acusado_por uuid references auth.users(id),
  notas text,
  created_at timestamptz not null default now()
);

alter table acuses_nomina enable row level security;
create policy "acuses_lectura" on acuses_nomina for select using (es_miembro_tenant(tenant_id));
create policy "acuses_insert" on acuses_nomina for insert with check (es_miembro_tenant(tenant_id));
create policy "acuses_update" on acuses_nomina for update using (es_miembro_tenant(tenant_id));

-- ============================================================
-- DISPUTAS
-- ============================================================

create table disputas (
  id_disputa uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id_tenant) on delete cascade,
  sociedad_id uuid not null references sociedades(id_sociedad),
  resultado_id uuid not null references resultados_calculo(id_resultado),
  comisionado_id uuid not null references comisionados(id_comisionado),
  tipo text not null check (tipo in ('monto','atribucion','periodo','otro')),
  descripcion text not null,
  estado text not null default 'abierta'
    check (estado in ('abierta','en_revision','resuelta')),
  sla_fecha date not null,
  asignada_a uuid references auth.users(id),
  resuelta_en timestamptz,
  resolucion text,
  genera_ajuste boolean not null default false,
  abierta_por uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table disputas enable row level security;
create policy "disputas_lectura_staff" on disputas for select using (es_miembro_tenant(tenant_id));
create policy "disputas_insert" on disputas for insert
  with check (
    exists (select 1 from comisionados c where c.id_comisionado = comisionado_id and c.usuario_id = auth.uid())
    or es_miembro_sociedad(sociedad_id)
  );
create policy "disputas_update" on disputas for update using (es_miembro_sociedad(sociedad_id));
create policy "disputas_lectura_portal" on disputas for select
  using (exists (select 1 from comisionados c where c.id_comisionado = comisionado_id and c.usuario_id = auth.uid()));
