-- =============================================================================
-- Devenga — Fase 2 (§10 "Gobierno")
--
-- Campañas con autorización + simulación (§3.5, §2.8 regla 4), metas con
-- workflow (§2.7), controles bloqueantes reforzados y cierre. La mayoría del
-- modelo de datos ya existía en schema_fase1.sql (estado de metas, serie_id,
-- motivo_version, alcance_retroactivo de campañas); esta fase agrega solo lo
-- que faltaba: la evidencia de la excepción de presupuesto en campañas.
--
-- Requiere supabase/schema.sql + seed_fase0.sql + schema_fase1.sql ya aplicados.
-- =============================================================================

-- §2.8 regla 4 — "el motor valida presupuesto_tope contra el devengo
-- proyectado y bloquea la publicación si lo excede sin autorización de nivel
-- superior". Estas tres columnas son esa autorización de excepción,
-- distinta de `autorizador`/`nivel_autorizacion` (que evidencian la puerta 3
-- — autorizar la campaña en sí — no la excepción de presupuesto al publicar).
alter table public.campanas
  add column if not exists excepcion_presupuesto_motivo text,
  add column if not exists excepcion_presupuesto_autorizado_por text,
  add column if not exists excepcion_presupuesto_en timestamptz,
  add constraint excepcion_presupuesto_exige_motivo
    check (excepcion_presupuesto_autorizado_por is null or (excepcion_presupuesto_motivo is not null and char_length(excepcion_presupuesto_motivo) >= 20));

-- -----------------------------------------------------------------------------
-- §2.7 / §4.4 — workflow de metas en dos pasos, cada uno con su propio rol.
-- La política de update de Fase 1 ("Aprueba metas actualiza") permitía que
-- solo aprueba_metas tocara una meta, lo que en la práctica bloqueaba a
-- carga_metas de enviar su propio borrador a aprobación. Se reemplaza por dos
-- políticas que además fijan la transición de estado permitida en cada rol,
-- para que la segregación de funciones sea una regla de base de datos, no
-- solo una convención de la UI.
-- -----------------------------------------------------------------------------
drop policy if exists "Aprueba metas actualiza — nunca quien la cargó (§4.4)" on public.metas;

create policy "Carga metas envía a aprobación" on public.metas for update
  using (public.tiene_rol_en_sociedad(sociedad_id, array['admin', 'carga_metas']::public.rol_sociedad[]) and estado = 'borrador')
  with check (estado = 'en_aprobacion');

create policy "Aprueba metas resuelve" on public.metas for update
  using (public.tiene_rol_en_sociedad(sociedad_id, array['admin', 'aprueba_metas']::public.rol_sociedad[]) and estado = 'en_aprobacion')
  with check (estado in ('vigente', 'superada'));

-- Marca versiones anteriores de la misma serie como "superada" cuando una
-- nueva versión queda vigente — evita dejar dos versiones "vigente" a la vez.
create or replace function public.fn_superar_versiones_anteriores()
returns trigger as $$
begin
  if new.estado = 'vigente' and (old.estado is distinct from 'vigente') then
    update public.metas
      set estado = 'superada'
      where serie_id = new.serie_id and id_meta <> new.id_meta and estado = 'vigente';
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_superar_versiones_anteriores
  after update on public.metas
  for each row execute function public.fn_superar_versiones_anteriores();
