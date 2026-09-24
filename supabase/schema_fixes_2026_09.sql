-- =============================================================================
-- Devenga — correcciones encontradas probando el flujo completo contra un
-- Supabase real por primera vez (2026-09-18). Ver docs/fase-1..3/00-resumen.md:
-- todas advertían que nada se había ejercitado contra Postgres real todavía.
-- Requiere schema.sql + seed_fase0.sql + schema_fase1/2/3.sql ya aplicados.
-- =============================================================================

-- §3.3/§3.6 — el orquestador de cálculo escribe en `creditos` y
-- `resultados_calculo` (insert/update/delete) actuando con la sesión del
-- usuario que dispara el cálculo o el cierre, no con una service role. Fase 1
-- solo había dejado políticas de SELECT en ambas tablas — cualquier intento
-- real de calcular un período quedaba bloqueado por RLS antes de llegar al
-- motor. `periodos` tenía el mismo problema para INSERT: nunca se pudo abrir
-- un período nuevo desde la UI.

create policy "Miembros abren períodos de su sociedad" on public.periodos for insert
  with check (public.tiene_rol_en_sociedad(sociedad_id, array['admin', 'jefatura_comercial', 'control_gestion']::public.rol_sociedad[]));

create policy "Miembros escriben créditos vía transacción" on public.creditos for insert
  with check (exists (select 1 from public.transacciones t where t.id_transaccion = creditos.transaccion_id and public.es_miembro_sociedad(t.sociedad_id)));
create policy "Miembros borran créditos vía transacción" on public.creditos for delete
  using (exists (select 1 from public.transacciones t where t.id_transaccion = creditos.transaccion_id and public.es_miembro_sociedad(t.sociedad_id)));

-- §3.2 — `snapshot_jerarquia` quedó NOT NULL en Fase 1, pero un comisionado
-- sin nodo de jerarquía asignado (el caso normal en una organización chica,
-- como la de esta misma prueba) genera créditos con `snapshot_jerarquia =
-- null` legítimamente. La restricción bloqueaba el insert de todo crédito en
-- esa situación, y el insert fallaba en silencio porque el código no
-- revisaba `error` (ver también el mismo problema de errores no revisados
-- en calcular/route.ts, corregido aparte).
alter table public.creditos alter column snapshot_jerarquia drop not null;

create policy "Miembros escriben resultados de su sociedad" on public.resultados_calculo for insert
  with check (public.es_miembro_sociedad(sociedad_id));
create policy "Miembros actualizan resultados de su sociedad" on public.resultados_calculo for update
  using (public.es_miembro_sociedad(sociedad_id));
create policy "Miembros borran resultados de su sociedad" on public.resultados_calculo for delete
  using (public.es_miembro_sociedad(sociedad_id));
