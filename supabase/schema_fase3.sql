-- =============================================================================
-- Motor de Comisiones — Fase 3 (§10 "Portal y disputas")
--
-- Requiere supabase/schema.sql + seed_fase0.sql + schema_fase1.sql +
-- schema_fase2.sql ya aplicados.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Login del comisionado al portal — no está en el texto literal de la
-- especificación (que no define un mecanismo de autenticación concreto para
-- §5); es la implementación mínima necesaria para que el portal exista como
-- algo distinto del panel de administración de la sociedad. Un comisionado
-- puede no tener usuario_id (portal aún no habilitado para él).
-- -----------------------------------------------------------------------------
alter table public.comisionados
  add column if not exists usuario_id uuid references auth.users(id);

create unique index if not exists comisionados_usuario_id_key on public.comisionados(usuario_id) where usuario_id is not null;

alter table public.comisionados enable row level security;
create policy "El comisionado ve su propio registro" on public.comisionados for select
  using (usuario_id = auth.uid());

-- Vincular una cuenta de portal a un comisionado es una acción de staff, no
-- autoservicio: dejar que la persona "reclame" su registro escribiendo su
-- propio identificador_personal sería una forma fácil de que alguien se
-- vincule al comisionado equivocado (los identificadores personales no son
-- secretos). El staff de la sociedad ya tiene acceso de confianza al
-- comisionado; es quien vincula el email de portal a la ficha correcta.
create policy "Staff vincula usuario a comisionado" on public.comisionados for update
  using (exists (
    select 1 from public.comisionado_sociedad cs
    where cs.comisionado_id = comisionados.id_comisionado and public.es_miembro_sociedad(cs.sociedad_id)
  ));

-- -----------------------------------------------------------------------------
-- Cierra el TODO dejado en schema.sql ("FK real llega en Fase 1"): ahora que
-- `comisionados`/`sociedades` existen, movimientos_devengo referencia de
-- verdad en vez de guardar el id como texto suelto.
-- -----------------------------------------------------------------------------
alter table public.movimientos_devengo
  alter column comisionado type uuid using comisionado::uuid,
  alter column sociedad type uuid using sociedad::uuid;

alter table public.movimientos_devengo
  add constraint movimientos_devengo_comisionado_fkey foreign key (comisionado) references public.comisionados(id_comisionado),
  add constraint movimientos_devengo_sociedad_fkey foreign key (sociedad) references public.sociedades(id_sociedad);

-- -----------------------------------------------------------------------------
-- RLS de portal — el comisionado lee lo suyo. Se agrega a las políticas de
-- staff ya existentes (por sociedad), no las reemplaza.
-- -----------------------------------------------------------------------------
create policy "El comisionado ve sus propios créditos" on public.creditos for select
  using (exists (select 1 from public.comisionados c where c.id_comisionado = creditos.comisionado_id and c.usuario_id = auth.uid()));

create policy "El comisionado ve sus propios resultados" on public.resultados_calculo for select
  using (exists (select 1 from public.comisionados c where c.id_comisionado = resultados_calculo.comisionado_id and c.usuario_id = auth.uid()));

-- movimientos_devengo se creó en schema.sql (Fase 0) sin RLS — no existía
-- todavía el concepto de sociedad/comisionado. Queda corregido aquí: es una
-- de las tablas más sensibles del sistema (lleva el importe que se le paga a
-- cada persona) y había quedado sin ninguna política.
alter table public.movimientos_devengo enable row level security;
create policy "El comisionado ve sus propios movimientos" on public.movimientos_devengo for select
  using (exists (select 1 from public.comisionados c where c.id_comisionado = movimientos_devengo.comisionado and c.usuario_id = auth.uid()));
create policy "Staff de la sociedad ve los movimientos" on public.movimientos_devengo for select
  using (public.es_miembro_sociedad(sociedad));
create policy "Staff de la sociedad genera movimientos" on public.movimientos_devengo for insert
  with check (public.es_miembro_sociedad(sociedad));
create policy "Staff de la sociedad actualiza estado de movimientos" on public.movimientos_devengo for update
  using (public.es_miembro_sociedad(sociedad));

create policy "El comisionado ve sus propias metas" on public.metas for select
  using (destino_tipo = 'comisionado' and exists (select 1 from public.comisionados c where c.id_comisionado = metas.destino_id and c.usuario_id = auth.uid()));

create policy "El comisionado ve campañas publicadas de su sociedad" on public.campanas for select
  using (estado = 'publicada' and exists (
    select 1 from public.comisionado_sociedad cs join public.comisionados c on c.id_comisionado = cs.comisionado_id
    where cs.sociedad_id = campanas.sociedad_id and c.usuario_id = auth.uid()
  ));

-- -----------------------------------------------------------------------------
-- Acuse de nómina (§3.9, puerta 6) — la tabla ya existía desde Fase 0; falta
-- la RLS para que el staff de la sociedad pueda registrarlo.
-- -----------------------------------------------------------------------------
alter table public.acuses_nomina enable row level security;
create policy "Staff ve y registra acuses de su sociedad" on public.acuses_nomina for all
  using (exists (select 1 from public.movimientos_devengo m where m.id_movimiento = acuses_nomina.id_movimiento and public.es_miembro_sociedad(m.sociedad)));

-- -----------------------------------------------------------------------------
-- Disputas (§3.10) — flujo obligatorio: apertura → clasificación → asignación
-- → SLA por tipo → resolución con motivo → ajuste si procede.
-- -----------------------------------------------------------------------------
create table public.disputas (
  id uuid primary key default uuid_generate_v4(),
  comisionado_id uuid not null references public.comisionados(id_comisionado),
  sociedad_id uuid not null references public.sociedades(id_sociedad),
  referencia_tipo text not null check (referencia_tipo in ('concepto', 'operacion')),
  referencia_id text not null,
  clasificacion text not null check (clasificacion in ('atribucion', 'monto', 'meta', 'campana', 'plan', 'pago')),
  descripcion text not null,
  estado text not null default 'abierta' check (estado in ('abierta', 'asignada', 'en_resolucion', 'resuelta', 'rechazada')),
  asignado_a text,
  sla_vence_en timestamptz not null,
  resuelta_por text,
  resuelta_en timestamptz,
  motivo_resolucion text,
  genera_ajuste boolean not null default false,
  created_at timestamptz default now(),
  constraint descripcion_no_trivial check (char_length(descripcion) >= 10),
  constraint resolucion_exige_motivo check (estado not in ('resuelta', 'rechazada') or (motivo_resolucion is not null and resuelta_por is not null))
);

alter table public.disputas enable row level security;

create policy "El comisionado ve y abre sus propias disputas" on public.disputas for select
  using (exists (select 1 from public.comisionados c where c.id_comisionado = disputas.comisionado_id and c.usuario_id = auth.uid()));
create policy "El comisionado abre disputas" on public.disputas for insert
  with check (exists (select 1 from public.comisionados c where c.id_comisionado = disputas.comisionado_id and c.usuario_id = auth.uid()));

create policy "Staff de la sociedad ve disputas" on public.disputas for select
  using (public.es_miembro_sociedad(sociedad_id));
create policy "Resuelve disputas asigna y resuelve" on public.disputas for update
  using (public.tiene_rol_en_sociedad(sociedad_id, array['admin', 'resuelve_disputas']::public.rol_sociedad[]));
