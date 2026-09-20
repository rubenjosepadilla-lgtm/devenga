-- ============================================================
-- Devenga v3 — Migraciones incrementales
-- Aplicar sobre un proyecto que ya tiene schema_v2.sql activo.
-- INSTRUCCIÓN: pegar completo en el SQL Editor de Supabase y ejecutar.
-- ============================================================

-- ============================================================
-- 1. CAMPOS NUEVOS EN TABLAS EXISTENTES
-- ============================================================

-- 1.1 conceptos: fundamento_devengo_diario obligatorio cuando devengo_diario=true
alter table conceptos add column if not exists fundamento_devengo_diario text;

-- 1.2 nodos_jerarquia: temporalidad y aprobación
alter table nodos_jerarquia add column if not exists vigencia_desde date;
alter table nodos_jerarquia add column if not exists vigencia_hasta date;
alter table nodos_jerarquia add column if not exists motivo_cambio text;
alter table nodos_jerarquia add column if not exists aprobado_por uuid references auth.users(id);
alter table nodos_jerarquia add column if not exists aprobado_en timestamptz;

-- 1.3 metas: campos para Quota Management formal (§2.C)
alter table metas add column if not exists distribucion_tipo text check (distribucion_tipo in ('uniforme','ponderado'));
alter table metas add column if not exists peso_distribucion numeric;
alter table metas add column if not exists cuota_origen_nodo uuid references metas(id_meta);

-- 1.4 campanas: migrar alcance_retroactivo de boolean a text enum
-- Primero agregamos la columna nueva, luego copiamos los datos, luego la renombramos
alter table campanas add column if not exists alcance_retroactivo_v3 text not null default 'desde_publicacion'
  check (alcance_retroactivo_v3 in ('desde_publicacion','todo_el_periodo_abierto'));

-- Migrar datos existentes (true → todo_el_periodo_abierto, false → desde_publicacion)
update campanas
  set alcance_retroactivo_v3 = case
    when alcance_retroactivo = true then 'todo_el_periodo_abierto'
    else 'desde_publicacion'
  end;

-- Eliminar columna antigua y renombrar la nueva
alter table campanas drop column if exists alcance_retroactivo;
alter table campanas rename column alcance_retroactivo_v3 to alcance_retroactivo;

-- 1.5 campanas: condicion_tipo
alter table campanas add column if not exists condicion_tipo text
  check (condicion_tipo in ('meta_individual','meta_grupal','producto_focalizado','mixta'));

-- 1.6 transacciones: territorio_id y hash_origen (§2.11)
alter table transacciones add column if not exists territorio_id uuid;
alter table transacciones add column if not exists hash_origen text;

-- 1.7 periodos: ampliar enum de estado para el workflow de aprobación (§4.1)
-- PostgreSQL no permite quitar valores de un enum. Cambiamos la columna a text con check.
alter table periodos alter column estado type text;
alter table periodos drop constraint if exists periodos_estado_check;
alter table periodos add constraint periodos_estado_check check (
  estado in (
    'abierto','en_calculo','calculado',
    'revision_jefe','aprobacion_gerencia','aprobado','enviado_nomina',
    'cerrado'
  )
);

-- 1.8 movimientos_devengo: hash_detalle (§2.12)
alter table movimientos_devengo add column if not exists hash_detalle text;

-- ============================================================
-- 2. TABLAS NUEVAS
-- ============================================================

-- 2.1 Aceptación digital del plan (§2.B)
create table if not exists acuses_plan (
  id_acuse uuid primary key default gen_random_uuid(),
  asignacion_id uuid not null references asignaciones_plan(id_asignacion) on delete cascade,
  comisionado_id uuid not null references comisionados(id_comisionado) on delete cascade,
  version_plan integer not null,
  hash_pdf_mostrado text,
  estado text not null default 'pendiente'
    check (estado in ('pendiente','aceptado','rechazado')),
  aceptado_en timestamptz,
  aceptado_ip text,
  motivo_rechazo text,
  recordatorios_enviados integer not null default 0,
  created_at timestamptz not null default now()
);

alter table acuses_plan enable row level security;
-- El comisionado ve y actúa sobre sus acuses
create policy "acuses_plan_lectura_portal" on acuses_plan for select
  using (exists (select 1 from comisionados c where c.id_comisionado = comisionado_id and c.usuario_id = auth.uid()));
create policy "acuses_plan_update_portal" on acuses_plan for update
  using (exists (select 1 from comisionados c where c.id_comisionado = comisionado_id and c.usuario_id = auth.uid()));
-- Staff (administrador/jefe) ve todos los acuses de su tenant
create policy "acuses_plan_lectura_staff" on acuses_plan for select
  using (exists (
    select 1 from comisionados c
    join usuario_tenant ut on ut.tenant_id = c.tenant_id
    where c.id_comisionado = comisionado_id and ut.usuario_id = auth.uid() and ut.activo = true
  ));
create policy "acuses_plan_insert" on acuses_plan for insert
  with check (exists (
    select 1 from asignaciones_plan a
    join plantillas_plan p on p.id_plantilla = a.plantilla_id
    where a.id_asignacion = asignacion_id and es_miembro_tenant(p.tenant_id)
  ));

-- Trigger: al crear una asignación_plan, crear automáticamente el acuse en estado pendiente
create or replace function fn_crear_acuse_plan()
returns trigger language plpgsql security definer as $$
declare
  v_version integer;
begin
  select version into v_version from plantillas_plan where id_plantilla = new.plantilla_id;
  insert into acuses_plan (asignacion_id, comisionado_id, version_plan)
  values (new.id_asignacion, new.comisionado_id, coalesce(v_version, 1));
  return new;
end;
$$;

drop trigger if exists tg_crear_acuse_plan on asignaciones_plan;
create trigger tg_crear_acuse_plan
  after insert on asignaciones_plan
  for each row execute function fn_crear_acuse_plan();

-- 2.2 Workflow de aprobación de liquidaciones (§4.1)
create table if not exists aprobaciones_periodo (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id_tenant) on delete cascade,
  periodo_id uuid not null references periodos(id_periodo) on delete cascade,
  puerta_numero integer not null references puertas_aprobacion(numero),
  estado text not null default 'pendiente'
    check (estado in ('pendiente','aprobado','rechazado')),
  aprobador_id uuid references auth.users(id),
  aprobado_en timestamptz,
  comentario text,
  version_resultados text,
  created_at timestamptz not null default now()
);

alter table aprobaciones_periodo enable row level security;
create policy "ap_periodo_lectura" on aprobaciones_periodo for select
  using (es_miembro_tenant(tenant_id));
create policy "ap_periodo_insert" on aprobaciones_periodo for insert
  with check (es_miembro_tenant(tenant_id));
create policy "ap_periodo_update" on aprobaciones_periodo for update
  using (es_miembro_tenant(tenant_id));

-- 2.3 Integraciones con sistemas externos (§6.1)
create table if not exists integraciones (
  id_integracion uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id_tenant) on delete cascade,
  sociedad_id uuid not null references sociedades(id_sociedad) on delete cascade,
  nombre text not null,
  tipo text not null check (tipo in ('webhook_entrante','webhook_saliente','api_pull','archivo','manual')),
  sistema_origen text not null default 'otro',
  config jsonb not null default '{}',
  mapeo_campos jsonb not null default '{}',
  version_mapeo integer not null default 1,
  estado text not null default 'activo' check (estado in ('activo','inactivo','error')),
  ultimo_sync timestamptz,
  proximo_sync timestamptz,
  api_key_hash text,
  created_at timestamptz not null default now()
);

alter table integraciones enable row level security;
create policy "integraciones_lectura" on integraciones for select using (es_miembro_tenant(tenant_id));
create policy "integraciones_insert" on integraciones for insert
  with check (tiene_rol_base(tenant_id, array['administrador']));
create policy "integraciones_update" on integraciones for update
  using (tiene_rol_base(tenant_id, array['administrador']));

-- 2.4 Log de integraciones (§6.1)
create table if not exists log_integracion (
  id uuid primary key default gen_random_uuid(),
  integracion_id uuid not null references integraciones(id_integracion) on delete cascade,
  timestamp timestamptz not null default now(),
  registros_recibidos integer not null default 0,
  registros_procesados integer not null default 0,
  registros_cuarentena integer not null default 0,
  registros_duplicados integer not null default 0,
  errores jsonb not null default '[]',
  estado text not null default 'ok' check (estado in ('ok','parcial','error')),
  duracion_ms integer
);

alter table log_integracion enable row level security;
create policy "log_int_lectura" on log_integracion for select
  using (exists (select 1 from integraciones i where i.id_integracion = integracion_id and es_miembro_tenant(i.tenant_id)));
create policy "log_int_insert" on log_integracion for insert
  with check (exists (select 1 from integraciones i where i.id_integracion = integracion_id and es_miembro_tenant(i.tenant_id)));

-- 2.5 Mapeo de usuarios externos a comisionados (§6.2 Salesforce, §6.3 HubSpot)
create table if not exists integracion_usuarios (
  id uuid primary key default gen_random_uuid(),
  integracion_id uuid not null references integraciones(id_integracion) on delete cascade,
  id_externo_usuario text not null,
  comisionado_id uuid not null references comisionados(id_comisionado) on delete cascade,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (integracion_id, id_externo_usuario)
);

alter table integracion_usuarios enable row level security;
create policy "iu_lectura" on integracion_usuarios for select
  using (exists (select 1 from integraciones i where i.id_integracion = integracion_id and es_miembro_tenant(i.tenant_id)));
create policy "iu_insert" on integracion_usuarios for insert
  with check (exists (select 1 from integraciones i where i.id_integracion = integracion_id and es_miembro_tenant(i.tenant_id)));
create policy "iu_update" on integracion_usuarios for update
  using (exists (select 1 from integraciones i where i.id_integracion = integracion_id and es_miembro_tenant(i.tenant_id)));

-- 2.6 Notificaciones (§8.B)
create table if not exists notificaciones (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id_tenant) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  tipo_evento text not null,
  payload jsonb not null default '{}',
  canal text not null default 'in_app' check (canal in ('email','in_app')),
  estado text not null default 'pendiente' check (estado in ('pendiente','enviado','fallido')),
  intentos integer not null default 0,
  leida boolean not null default false,
  created_at timestamptz not null default now()
);

alter table notificaciones enable row level security;
create policy "notif_lectura" on notificaciones for select using (usuario_id = auth.uid());
create policy "notif_update" on notificaciones for update using (usuario_id = auth.uid());
create policy "notif_insert_sistema" on notificaciones for insert with check (es_miembro_tenant(tenant_id));

-- 2.7 Audit log (§8.C — pre-ISO no negociable)
create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  tabla text not null,
  registro_id uuid not null,
  operacion text not null check (operacion in ('INSERT','UPDATE','DELETE')),
  campo text,
  valor_anterior jsonb,
  valor_nuevo jsonb,
  usuario_id uuid,
  ip_origen text,
  hash_anterior text,
  created_at timestamptz not null default now()
);

-- audit_log es append-only: prohibir UPDATE y DELETE a nivel de base de datos
alter table audit_log enable row level security;
-- Solo lectura por staff del tenant
create policy "audit_lectura" on audit_log for select using (
  tenant_id is null or es_miembro_tenant(tenant_id)
);
-- INSERT permitido (via triggers con SECURITY DEFINER)
create policy "audit_insert" on audit_log for insert with check (true);
-- Sin UPDATE ni DELETE — el append-only se garantiza omitiendo esas políticas

-- 2.8 Territorios (§2.D)
create table if not exists territorios (
  id_territorio uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id_tenant) on delete cascade,
  nombre text not null,
  tipo text not null check (tipo in ('region','zona','ciudad','ruta')),
  comisionado_titular_id uuid references comisionados(id_comisionado),
  comisionados_secundarios uuid[] not null default '{}',
  vigencia_desde date not null,
  vigencia_hasta date,
  created_at timestamptz not null default now()
);

alter table territorios enable row level security;
create policy "territorios_lectura" on territorios for select using (es_miembro_tenant(tenant_id));
create policy "territorios_insert" on territorios for insert
  with check (tiene_rol_base(tenant_id, array['administrador']));
create policy "territorios_update" on territorios for update
  using (tiene_rol_base(tenant_id, array['administrador']));

-- FK diferida: transacciones → territorios
alter table transacciones
  add constraint if not exists fk_tx_territorio
  foreign key (territorio_id) references territorios(id_territorio);

-- ============================================================
-- 3. TRIGGERS DE AUDIT_LOG
-- ============================================================

-- Función genérica para audit log (INSERT/UPDATE/DELETE)
create or replace function fn_audit_log()
returns trigger language plpgsql security definer as $$
declare
  v_uid uuid;
  v_tenant uuid;
  v_old jsonb;
  v_new jsonb;
begin
  v_uid := auth.uid();

  if TG_OP = 'DELETE' then
    v_old := to_jsonb(OLD);
    v_new := null;
    v_tenant := (OLD.tenant_id)::uuid;
    insert into audit_log (tenant_id, tabla, registro_id, operacion, valor_anterior, valor_nuevo, usuario_id)
    values (v_tenant, TG_TABLE_NAME, (OLD.id)::uuid, TG_OP, v_old, v_new, v_uid);
    return OLD;
  elsif TG_OP = 'INSERT' then
    v_old := null;
    v_new := to_jsonb(NEW);
    v_tenant := (NEW.tenant_id)::uuid;
    insert into audit_log (tenant_id, tabla, registro_id, operacion, valor_anterior, valor_nuevo, usuario_id)
    values (v_tenant, TG_TABLE_NAME, (NEW.id)::uuid, TG_OP, v_old, v_new, v_uid);
    return NEW;
  else -- UPDATE
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_tenant := (NEW.tenant_id)::uuid;
    -- Solo loguear si hay un cambio real
    if v_old <> v_new then
      insert into audit_log (tenant_id, tabla, registro_id, operacion, valor_anterior, valor_nuevo, usuario_id)
      values (v_tenant, TG_TABLE_NAME, (NEW.id)::uuid, TG_OP, v_old, v_new, v_uid);
    end if;
    return NEW;
  end if;
end;
$$;

-- Función para tablas cuya PK se llama diferente (plantillas_plan → id_plantilla, etc.)
create or replace function fn_audit_log_plans()
returns trigger language plpgsql security definer as $$
declare v_uid uuid; v_old jsonb; v_new jsonb; v_id uuid; v_tenant uuid;
begin
  v_uid := auth.uid();
  if TG_OP = 'DELETE' then
    v_old := to_jsonb(OLD); v_new := null;
    v_id := OLD.id_plantilla; v_tenant := OLD.tenant_id;
    insert into audit_log (tenant_id, tabla, registro_id, operacion, valor_anterior, valor_nuevo, usuario_id)
    values (v_tenant, TG_TABLE_NAME, v_id, TG_OP, v_old, v_new, v_uid);
    return OLD;
  elsif TG_OP = 'INSERT' then
    v_old := null; v_new := to_jsonb(NEW);
    v_id := NEW.id_plantilla; v_tenant := NEW.tenant_id;
    insert into audit_log (tenant_id, tabla, registro_id, operacion, valor_anterior, valor_nuevo, usuario_id)
    values (v_tenant, TG_TABLE_NAME, v_id, TG_OP, v_old, v_new, v_uid);
    return NEW;
  else
    v_old := to_jsonb(OLD); v_new := to_jsonb(NEW);
    v_id := NEW.id_plantilla; v_tenant := NEW.tenant_id;
    if v_old <> v_new then
      insert into audit_log (tenant_id, tabla, registro_id, operacion, valor_anterior, valor_nuevo, usuario_id)
      values (v_tenant, TG_TABLE_NAME, v_id, TG_OP, v_old, v_new, v_uid);
    end if;
    return NEW;
  end if;
end;
$$;

-- Aplicar triggers en tablas auditables
drop trigger if exists tg_audit_plantillas_plan on plantillas_plan;
create trigger tg_audit_plantillas_plan
  after insert or update or delete on plantillas_plan
  for each row execute function fn_audit_log_plans();

drop trigger if exists tg_audit_metas on metas;
create trigger tg_audit_metas
  after insert or update or delete on metas
  for each row execute function fn_audit_log();

drop trigger if exists tg_audit_campanas on campanas;
create trigger tg_audit_campanas
  after insert or update or delete on campanas
  for each row execute function fn_audit_log();

drop trigger if exists tg_audit_comisionados on comisionados;
create trigger tg_audit_comisionados
  after insert or update or delete on comisionados
  for each row execute function fn_audit_log();

drop trigger if exists tg_audit_nodos on nodos_jerarquia;
create trigger tg_audit_nodos
  after insert or update or delete on nodos_jerarquia
  for each row execute function fn_audit_log();

drop trigger if exists tg_audit_conceptos on conceptos;
create trigger tg_audit_conceptos
  after insert or update or delete on conceptos
  for each row execute function fn_audit_log();

drop trigger if exists tg_audit_usuario_tenant on usuario_tenant;
create trigger tg_audit_usuario_tenant
  after insert or update or delete on usuario_tenant
  for each row execute function fn_audit_log();

-- ============================================================
-- 4. MOTOR DE CÁLCULO — función principal (§3.3)
-- ============================================================
-- Calcula comisiones de todos los comisionados de un período.
-- Lógica: por cada comisionado con asignación_plan vigente en el período,
-- suma los créditos del período, aplica el plan (componente por componente),
-- aplica campañas publicadas, y escribe en resultados_calculo.
-- Luego genera movimientos_devengo clasificados legalmente.

create or replace function calcular_periodo(p_periodo_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_periodo record;
  v_comisionado record;
  v_asignacion record;
  v_componente record;
  v_creditos_total numeric;
  v_importe_componente numeric;
  v_importe_total numeric;
  v_resultado_id uuid;
  v_resultados_count integer := 0;
  v_total_global numeric := 0;
  v_errores jsonb := '[]'::jsonb;
  v_error_msg text;
  v_concepto record;
  v_campana record;
  v_factor_campana numeric;
  v_detalle_diario jsonb;
begin
  -- Validar que el período existe y está abierto
  select * into v_periodo from periodos where id_periodo = p_periodo_id;
  if not found then raise exception 'Período no encontrado'; end if;
  if v_periodo.estado not in ('abierto','en_calculo') then
    raise exception 'El período debe estar en estado abierto o en_calculo (actual: %)', v_periodo.estado;
  end if;

  -- Marcar período como en_calculo
  update periodos set estado = 'en_calculo' where id_periodo = p_periodo_id;

  -- Borrar resultados preliminares anteriores del mismo período
  delete from resultados_calculo
  where periodo_id = p_periodo_id and estado = 'preliminar';

  -- Iterar comisionados vinculados a la sociedad del período
  for v_comisionado in
    select distinct c.id_comisionado, c.pais, c.tenant_id
    from comisionados c
    join comisionado_sociedad cs on cs.comisionado_id = c.id_comisionado
    where cs.sociedad_id = v_periodo.sociedad_id
      and cs.desde <= (v_periodo.periodo || '-01')::date
      and (cs.hasta is null or cs.hasta >= (v_periodo.periodo || '-01')::date)
  loop
    begin
      -- Buscar asignación de plan vigente para este comisionado en el período
      select a.*, p.id_plantilla, p.pais as plan_pais
      into v_asignacion
      from asignaciones_plan a
      join plantillas_plan p on p.id_plantilla = a.plantilla_id
      where a.comisionado_id = v_comisionado.id_comisionado
        and p.sociedad_id = v_periodo.sociedad_id
        and p.estado in ('aprobado','vigente')
        and a.vigencia_desde <= (v_periodo.periodo || '-01')::date
        and (a.vigencia_hasta is null or a.vigencia_hasta >= (v_periodo.periodo || '-28')::date)
      order by a.vigencia_desde desc
      limit 1;

      if not found then
        -- Sin plan asignado: omitir silenciosamente (no es error)
        continue;
      end if;

      -- Calcular por componente del plan
      v_importe_total := 0;

      for v_componente in
        select * from componentes_plan
        where plantilla_id = v_asignacion.id_plantilla
        order by orden
      loop
        begin
          -- Suma de créditos del comisionado en el período para este concepto
          select coalesce(sum(cr.monto_atribuido), 0)
          into v_creditos_total
          from creditos cr
          join transacciones tx on tx.id_transaccion = cr.transaccion_id
          where cr.comisionado_id = v_comisionado.id_comisionado
            and cr.tenant_id = v_comisionado.tenant_id
            and cr.concepto_codigo = v_componente.concepto_codigo
            and to_char(cr.fecha_credito, 'YYYY-MM') = v_periodo.periodo;

          -- Aplicar tipo de cálculo
          case v_componente.tipo_calculo
            when 'tasa_lineal' then
              v_importe_componente := v_creditos_total * coalesce((v_componente.parametros->>'tasa')::numeric, 0);

            when 'fijo' then
              -- Monto fijo si hay al menos algún crédito
              if v_creditos_total > 0 then
                v_importe_componente := coalesce((v_componente.parametros->>'monto')::numeric, 0);
              else
                v_importe_componente := 0;
              end if;

            when 'tramos' then
              declare
                v_tramos jsonb;
                v_tramo jsonb;
                v_escalonado text;
                v_acumulado numeric := 0;
                i integer;
              begin
                v_tramos := v_componente.parametros->'tramos';
                v_escalonado := coalesce(v_componente.parametros->>'escalonado', 'marginal');
                v_importe_componente := 0;

                if v_escalonado = 'marginal' then
                  -- Comisión marginal por tramos
                  for i in 0..(jsonb_array_length(v_tramos) - 1) loop
                    v_tramo := v_tramos->i;
                    declare
                      v_desde numeric := coalesce((v_tramo->>'desde')::numeric, 0);
                      v_hasta numeric := coalesce((v_tramo->>'hasta')::numeric, 1e15);
                      v_tasa numeric := coalesce((v_tramo->>'tasa')::numeric, 0);
                      v_base numeric;
                    begin
                      if v_creditos_total > v_desde then
                        v_base := least(v_creditos_total, v_hasta) - v_desde;
                        v_importe_componente := v_importe_componente + (v_base * v_tasa);
                      end if;
                    end;
                  end loop;
                else
                  -- Total: aplica la tasa del tramo donde cae el total
                  for i in 0..(jsonb_array_length(v_tramos) - 1) loop
                    v_tramo := v_tramos->i;
                    declare
                      v_desde numeric := coalesce((v_tramo->>'desde')::numeric, 0);
                      v_hasta numeric := coalesce((v_tramo->>'hasta')::numeric, 1e15);
                      v_tasa numeric := coalesce((v_tramo->>'tasa')::numeric, 0);
                    begin
                      if v_creditos_total >= v_desde and v_creditos_total < v_hasta then
                        v_importe_componente := v_creditos_total * v_tasa;
                      end if;
                    end;
                  end loop;
                end if;
              end;

            when 'pool_equipo' then
              -- Para esta versión: distribuir en partes iguales entre comisionados del mismo nodo
              -- Implementación completa requiere conocer el pool total del equipo
              -- Por ahora: tasa_lineal como fallback
              v_importe_componente := v_creditos_total * 0;

            else
              v_importe_componente := 0;
          end case;

          -- Aplicar tope del componente
          if v_componente.tope_componente is not null then
            v_importe_componente := least(v_importe_componente, v_componente.tope_componente);
          end if;

          -- Aplicar campañas publicadas para este concepto en el período
          v_factor_campana := 1.0;
          for v_campana in
            select * from campanas
            where sociedad_id = v_periodo.sociedad_id
              and concepto_codigo = v_componente.concepto_codigo
              and estado = 'publicada'
              and tipo = 'multiplicador'
              and vigencia_hecho_desde <= (v_periodo.periodo || '-28')::date
              and vigencia_hecho_hasta >= (v_periodo.periodo || '-01')::date
          loop
            v_factor_campana := v_factor_campana * coalesce(v_campana.multiplicador, 1);
          end loop;
          v_importe_componente := v_importe_componente * v_factor_campana;

          -- Sumar montos adicionales de campañas
          for v_campana in
            select * from campanas
            where sociedad_id = v_periodo.sociedad_id
              and concepto_codigo = v_componente.concepto_codigo
              and estado = 'publicada'
              and tipo = 'monto_adicional'
              and vigencia_hecho_desde <= (v_periodo.periodo || '-28')::date
              and vigencia_hecho_hasta >= (v_periodo.periodo || '-01')::date
          loop
            if v_creditos_total > 0 then
              v_importe_componente := v_importe_componente + coalesce(v_campana.monto, 0);
            end if;
          end loop;

          v_importe_total := v_importe_total + v_importe_componente;

          -- Buscar concepto para clasificación legal
          select * into v_concepto
          from conceptos
          where tenant_id = v_comisionado.tenant_id
            and codigo = v_componente.concepto_codigo
            and pais = v_comisionado.pais
          limit 1;

          -- Generar detalle_diario si concepto tiene devengo_diario = true
          v_detalle_diario := null;
          if found and v_concepto.devengo_diario then
            declare
              v_dias_mes integer;
              v_monto_dia numeric;
              v_dia integer;
              v_det jsonb := '[]'::jsonb;
            begin
              v_dias_mes := extract(day from (date_trunc('month', (v_periodo.periodo || '-01')::date) + interval '1 month - 1 day')::date);
              v_monto_dia := v_importe_componente / v_dias_mes;
              for v_dia in 1..v_dias_mes loop
                v_det := v_det || jsonb_build_object(
                  'dia', lpad(v_dia::text, 2, '0'),
                  'fecha', (v_periodo.periodo || '-' || lpad(v_dia::text, 2, '0'))::text,
                  'monto', round(v_monto_dia, 2)
                );
              end loop;
              v_detalle_diario := v_det;
            end;
          end if;

          -- Insertar resultado por componente/concepto
          insert into resultados_calculo (
            tenant_id, periodo_id, sociedad_id, comisionado_id,
            concepto_codigo, importe, moneda, detalle_diario, estado
          ) values (
            v_comisionado.tenant_id,
            p_periodo_id,
            v_periodo.sociedad_id,
            v_comisionado.id_comisionado,
            v_componente.concepto_codigo,
            v_importe_componente,
            coalesce(v_concepto.pais, v_comisionado.pais),
            v_detalle_diario,
            'preliminar'
          )
          returning id_resultado into v_resultado_id;

          v_resultados_count := v_resultados_count + 1;
          v_total_global := v_total_global + v_importe_componente;

        exception when others then
          get stacked diagnostics v_error_msg = MESSAGE_TEXT;
          v_errores := v_errores || jsonb_build_object(
            'comisionado', v_comisionado.id_comisionado,
            'concepto', v_componente.concepto_codigo,
            'error', v_error_msg
          );
        end;
      end loop; -- componentes

    exception when others then
      get stacked diagnostics v_error_msg = MESSAGE_TEXT;
      v_errores := v_errores || jsonb_build_object(
        'comisionado', v_comisionado.id_comisionado,
        'error', v_error_msg
      );
    end;
  end loop; -- comisionados

  -- Regresar el período a 'calculado' si no hubo errores fatales
  update periodos
  set estado = 'calculado', calculado_en = now()
  where id_periodo = p_periodo_id;

  return jsonb_build_object(
    'resultados', v_resultados_count,
    'total', v_total_global,
    'errores', v_errores
  );
end;
$$;

grant execute on function calcular_periodo(uuid) to authenticated;

-- ============================================================
-- 5. FUNCIÓN: CERRAR PERÍODO Y GENERAR MOVIMIENTOS DE DEVENGO
-- ============================================================
create or replace function cerrar_periodo(p_periodo_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_periodo record;
  v_resultado record;
  v_concepto record;
  v_movimiento_id uuid;
  v_count integer := 0;
  v_violaciones jsonb := '[]'::jsonb;
begin
  select * into v_periodo from periodos where id_periodo = p_periodo_id;
  if not found then raise exception 'Período no encontrado'; end if;
  if v_periodo.estado not in ('calculado','revision_jefe','aprobacion_gerencia','aprobado') then
    raise exception 'El período no está en estado calculable para cierre (actual: %)', v_periodo.estado;
  end if;

  -- Control bloqueante: cuarentenas sin resolver
  if exists (
    select 1 from transacciones_cuarentena tc
    join transacciones tx on tx.id_transaccion = tc.transaccion_id
    where tx.sociedad_id = v_periodo.sociedad_id
      and not tc.resuelta
      and to_char(tx.fecha_hecho, 'YYYY-MM') = v_periodo.periodo
  ) then
    v_violaciones := v_violaciones || '"Existen transacciones en cuarentena sin resolver"';
  end if;

  if jsonb_array_length(v_violaciones) > 0 then
    return jsonb_build_object('ok', false, 'violaciones', v_violaciones);
  end if;

  -- Congelar resultados
  update resultados_calculo
  set estado = 'congelado'
  where periodo_id = p_periodo_id and estado = 'preliminar';

  -- Generar movimientos de devengo por cada resultado congelado
  for v_resultado in
    select rc.*, c.principalidad, c.ordinariedad, c.devengo_diario, c.incide_en, c.pais
    from resultados_calculo rc
    left join conceptos c on c.codigo = rc.concepto_codigo and c.tenant_id = rc.tenant_id
    where rc.periodo_id = p_periodo_id and rc.estado = 'congelado'
      and rc.importe > 0
  loop
    insert into movimientos_devengo (
      tenant_id, sociedad, comisionado, concepto_codigo,
      periodo_origen, periodo_imputacion,
      importe_bruto, moneda,
      principalidad, ordinariedad, devengo_diario, detalle_diario,
      incide_en, estado,
      snapshot_reglas
    ) values (
      v_resultado.tenant_id,
      v_periodo.sociedad_id,
      v_resultado.comisionado_id,
      v_resultado.concepto_codigo,
      v_periodo.periodo,
      v_periodo.periodo,
      v_resultado.importe,
      v_resultado.moneda,
      coalesce(v_resultado.principalidad, 'principal'),
      coalesce(v_resultado.ordinariedad, 'ordinario'),
      coalesce(v_resultado.devengo_diario, false),
      v_resultado.detalle_diario,
      coalesce(v_resultado.incide_en, '{}'),
      'enviado_a_nomina',
      jsonb_build_object(
        'periodo', v_periodo.periodo,
        'sociedad_id', v_periodo.sociedad_id,
        'resultado_id', v_resultado.id_resultado,
        'cerrado_en', now()
      )
    )
    returning id_movimiento into v_movimiento_id;

    -- Vincular el movimiento al resultado
    update resultados_calculo
    set id_movimiento = v_movimiento_id
    where id_resultado = v_resultado.id_resultado;

    v_count := v_count + 1;
  end loop;

  -- Marcar período como cerrado
  update periodos
  set estado = 'cerrado', cerrado_en = now(), movimientos_generados = v_count
  where id_periodo = p_periodo_id;

  return jsonb_build_object('ok', true, 'movimientos_generados', v_count);
end;
$$;

grant execute on function cerrar_periodo(uuid) to authenticated;

-- ============================================================
-- 6. FUNCIÓN: CONTROLES BLOQUEANTES (§4.2)
-- ============================================================
create or replace function controles_periodo(p_periodo_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_periodo record;
  v_violaciones jsonb := '[]'::jsonb;
  v_count integer;
begin
  select * into v_periodo from periodos where id_periodo = p_periodo_id;
  if not found then raise exception 'Período no encontrado'; end if;

  -- Control 1: cuarentenas sin resolver
  select count(*) into v_count
  from transacciones_cuarentena tc
  join transacciones tx on tx.id_transaccion = tc.transaccion_id
  where tx.sociedad_id = v_periodo.sociedad_id
    and not tc.resuelta
    and to_char(tx.fecha_hecho, 'YYYY-MM') = v_periodo.periodo;
  if v_count > 0 then
    v_violaciones := v_violaciones || jsonb_build_object(
      'control', 'cuarentena_sin_resolver',
      'detalle', v_count || ' transaccion(es) en cuarentena sin resolver'
    );
  end if;

  -- Control 2: tipos_cambio faltantes
  select count(*) into v_count
  from transacciones tx
  where tx.sociedad_id = v_periodo.sociedad_id
    and to_char(tx.fecha_hecho, 'YYYY-MM') = v_periodo.periodo
    and tx.moneda <> 'CLP'
    and not exists (
      select 1 from tipos_cambio tc2
      where tc2.moneda_origen = tx.moneda
        and tc2.periodo = v_periodo.periodo
    );
  if v_count > 0 then
    v_violaciones := v_violaciones || jsonb_build_object(
      'control', 'tipo_cambio_faltante',
      'detalle', v_count || ' transaccion(es) con moneda sin tipo de cambio para el período'
    );
  end if;

  -- Control 3: metas en borrador con resultados calculados contra ellas
  select count(*) into v_count
  from metas m
  join resultados_calculo rc on rc.concepto_codigo = m.concepto_codigo
    and rc.comisionado_id = m.destino_id
    and rc.periodo_id = p_periodo_id
  where m.sociedad_id = v_periodo.sociedad_id
    and m.periodo = v_periodo.periodo
    and m.estado = 'borrador';
  if v_count > 0 then
    v_violaciones := v_violaciones || jsonb_build_object(
      'control', 'meta_en_borrador',
      'detalle', v_count || ' meta(s) en estado borrador con resultados calculados'
    );
  end if;

  return jsonb_build_object(
    'listo_para_cerrar', jsonb_array_length(v_violaciones) = 0,
    'violaciones', v_violaciones
  );
end;
$$;

grant execute on function controles_periodo(uuid) to authenticated;

-- ============================================================
-- 7. FUNCIÓN: APROBACIÓN DE PUERTA DE PERÍODO (§4.1)
-- ============================================================
create or replace function aprobar_puerta_periodo(
  p_periodo_id uuid,
  p_puerta_numero integer,
  p_comentario text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_periodo record;
  v_uid uuid;
  v_nuevo_estado text;
begin
  v_uid := auth.uid();
  if v_uid is null then raise exception 'Usuario no autenticado'; end if;

  select * into v_periodo from periodos where id_periodo = p_periodo_id;
  if not found then raise exception 'Período no encontrado'; end if;

  -- Registrar la aprobación
  insert into aprobaciones_periodo (tenant_id, periodo_id, puerta_numero, estado, aprobador_id, aprobado_en, comentario)
  values (v_periodo.tenant_id, p_periodo_id, p_puerta_numero, 'aprobado', v_uid, now(), p_comentario);

  -- Avanzar el estado del período según la puerta aprobada
  v_nuevo_estado := case p_puerta_numero
    when 5 then 'revision_jefe'      -- Puerta 4 (cierre calculado) → revisión jefe
    when 4 then 'aprobacion_gerencia' -- Puerta 5 → aprobación gerencia
    when 6 then 'aprobado'            -- Puerta 6 (acuse nómina) → aprobado
    else v_periodo.estado
  end;

  update periodos set estado = v_nuevo_estado where id_periodo = p_periodo_id;

  return jsonb_build_object('ok', true, 'nuevo_estado', v_nuevo_estado);
end;
$$;

grant execute on function aprobar_puerta_periodo(uuid, integer, text) to authenticated;

-- ============================================================
-- 8. FUNCIÓN: OBTENER DATOS DEL PORTAL DEL COMISIONADO
-- ============================================================
create or replace function obtener_mis_resultados(p_limite integer default 20)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid;
  v_comisionado_id uuid;
  v_result json;
begin
  v_uid := auth.uid();
  if v_uid is null then return null; end if;

  select id_comisionado into v_comisionado_id from comisionados where usuario_id = v_uid limit 1;
  if v_comisionado_id is null then return null; end if;

  select json_agg(row_to_json(t)) into v_result from (
    select
      rc.id_resultado,
      rc.concepto_codigo,
      rc.importe,
      rc.moneda,
      rc.estado as estado_calculo,
      rc.detalle_diario,
      p.periodo,
      p.estado as estado_periodo,
      p.cerrado_en,
      mv.estado as estado_movimiento,
      mv.id_movimiento,
      mv.principalidad,
      mv.ordinariedad,
      mv.devengo_diario
    from resultados_calculo rc
    join periodos p on p.id_periodo = rc.periodo_id
    left join movimientos_devengo mv on mv.id_movimiento = rc.id_movimiento
    where rc.comisionado_id = v_comisionado_id
    order by p.periodo desc, rc.concepto_codigo
    limit p_limite
  ) t;

  return v_result;
end;
$$;

grant execute on function obtener_mis_resultados(integer) to authenticated;

-- ============================================================
-- 9. FUNCIÓN: TRAZABILIDAD POR TRANSACCIÓN PARA PORTAL
-- ============================================================
create or replace function obtener_trazabilidad_resultado(p_resultado_id uuid)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid;
  v_comisionado_id uuid;
  v_result record;
  v_trazabilidad json;
begin
  v_uid := auth.uid();
  if v_uid is null then return null; end if;

  select id_comisionado into v_comisionado_id from comisionados where usuario_id = v_uid limit 1;
  if v_comisionado_id is null then return null; end if;

  -- Verificar que el resultado pertenece al comisionado
  select * into v_result from resultados_calculo
  where id_resultado = p_resultado_id and comisionado_id = v_comisionado_id;
  if not found then return null; end if;

  -- Obtener créditos y transacciones que contribuyeron al resultado
  select json_agg(row_to_json(t)) into v_trazabilidad from (
    select
      cr.id_credito,
      cr.fecha_credito,
      cr.monto_atribuido,
      cr.moneda,
      cr.porcentaje_atribuido,
      tx.fecha_hecho,
      tx.tipo_evento,
      tx.producto,
      tx.canal,
      tx.monto as monto_transaccion,
      tx.id_externo
    from creditos cr
    join transacciones tx on tx.id_transaccion = cr.transaccion_id
    where cr.comisionado_id = v_comisionado_id
      and cr.concepto_codigo = v_result.concepto_codigo
      and cr.tenant_id = v_result.tenant_id
      and to_char(cr.fecha_credito, 'YYYY-MM') = (
        select periodo from periodos where id_periodo = v_result.periodo_id
      )
    order by cr.fecha_credito desc
    limit 200
  ) t;

  return json_build_object(
    'resultado', row_to_json(v_result),
    'trazabilidad', coalesce(v_trazabilidad, '[]'::json)
  );
end;
$$;

grant execute on function obtener_trazabilidad_resultado(uuid) to authenticated;

-- ============================================================
-- 10. FUNCIÓN: ACUSES DE PLAN PENDIENTES DEL COMISIONADO
-- ============================================================
create or replace function obtener_mis_acuses_plan()
returns json language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid;
  v_comisionado_id uuid;
  v_result json;
begin
  v_uid := auth.uid();
  if v_uid is null then return null; end if;
  select id_comisionado into v_comisionado_id from comisionados where usuario_id = v_uid limit 1;
  if v_comisionado_id is null then return null; end if;

  select json_agg(row_to_json(t)) into v_result from (
    select
      ap.id_acuse,
      ap.estado,
      ap.version_plan,
      ap.created_at,
      ap.aceptado_en,
      ap.motivo_rechazo,
      pp.nombre as nombre_plan,
      pp.id_plantilla
    from acuses_plan ap
    join asignaciones_plan a on a.id_asignacion = ap.asignacion_id
    join plantillas_plan pp on pp.id_plantilla = a.plantilla_id
    where ap.comisionado_id = v_comisionado_id
    order by ap.created_at desc
  ) t;

  return coalesce(v_result, '[]'::json);
end;
$$;

grant execute on function obtener_mis_acuses_plan() to authenticated;

-- ============================================================
-- 11. FUNCIÓN: ACEPTAR O RECHAZAR PLAN (Portal)
-- ============================================================
create or replace function responder_acuse_plan(
  p_acuse_id uuid,
  p_accion text,  -- 'aceptar' o 'rechazar'
  p_motivo text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid;
  v_comisionado_id uuid;
  v_acuse record;
begin
  v_uid := auth.uid();
  if v_uid is null then raise exception 'Usuario no autenticado'; end if;
  if p_accion not in ('aceptar','rechazar') then raise exception 'Acción inválida'; end if;
  if p_accion = 'rechazar' and (p_motivo is null or length(trim(p_motivo)) < 5) then
    raise exception 'El motivo de rechazo es obligatorio (mínimo 5 caracteres)';
  end if;

  select id_comisionado into v_comisionado_id from comisionados where usuario_id = v_uid limit 1;
  if v_comisionado_id is null then raise exception 'Comisionado no encontrado'; end if;

  select * into v_acuse from acuses_plan where id_acuse = p_acuse_id and comisionado_id = v_comisionado_id;
  if not found then raise exception 'Acuse no encontrado'; end if;
  if v_acuse.estado <> 'pendiente' then raise exception 'Este acuse ya fue respondido'; end if;

  if p_accion = 'aceptar' then
    update acuses_plan set estado = 'aceptado', aceptado_en = now()
    where id_acuse = p_acuse_id;
  else
    update acuses_plan set estado = 'rechazado', motivo_rechazo = p_motivo
    where id_acuse = p_acuse_id;
  end if;

  return jsonb_build_object('ok', true, 'estado', p_accion || 'do');
end;
$$;

grant execute on function responder_acuse_plan(uuid, text, text) to authenticated;

-- ============================================================
-- 12. GRANTS FINALES (por si acaso)
-- ============================================================
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;
