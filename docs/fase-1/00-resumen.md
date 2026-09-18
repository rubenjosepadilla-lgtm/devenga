# Fase 1 — Núcleo

Cubre §10 "Fase 1 — Núcleo" de la especificación, con los cinco países desde
el inicio (decisión de esta sesión — ver [`docs/fase-0/05-riesgos.md`](../fase-0/05-riesgos.md)).

## Qué se construyó

- **Dato maestro** (§2.2–§2.11): sociedad, comisionado + vínculo versionado,
  jerarquía/nodos, plan (plantilla → componente → asignación → override),
  meta, campaña, fuente, transacción + splits, calendario de períodos y tipo
  de cambio. Ver [`supabase/schema_fase1.sql`](../../supabase/schema_fase1.sql)
  y [`src/lib/dominio/fase1/`](../../src/lib/dominio/fase1).
- **Motor** (§3.1–§3.11) como funciones puras en [`src/lib/motor/`](../../src/lib/motor):
  ingesta con cuarentena, atribución de créditos, cálculo por tipo de
  componente, aplicación de campañas, cierre con los diez controles
  bloqueantes (§4.2), y construcción del movimiento de devengo (§3.8).
  Probado end-to-end en memoria con `npm run demo` (ver
  [`scripts/demo-motor.ts`](../../scripts/demo-motor.ts)).
- **API** (§6): `POST /api/transacciones` (ingesta), `POST /api/periodos/[id]/calcular`
  (§3.3), `POST /api/periodos/[id]/cerrar` (§3.6/§4.2), `GET /api/periodos/[id]/movimientos`
  (modo archivo, JSON o CSV).
- **UI mínima**: alta de sociedades, comisionados, plantillas/componentes de
  plan, metas, campañas (con autorizar/publicar), ingesta de transacciones
  con cuarentena visible, y períodos con cálculo/cierre/exportación.
- **Roles y RLS**: `usuarios_app` + `usuario_rol_sociedad` con los roles de
  §4.4, y políticas RLS que separan quién carga metas de quién las aprueba,
  y quién diseña planes de quién los aprueba.

## Simplificaciones declaradas

Estas decisiones no están en el texto literal de la especificación — eran
necesarias para tener un sistema que corre, y quedan documentadas para no
confundirlas con requisitos de negocio verificados:

1. **`sociedad_id` en `plantillas_plan` y `metas`.** El texto de §2.6/§2.7
   solo menciona `pais` como alcance de la plantilla; se agregó `sociedad_id`
   porque la aprobación (puerta 1) y el presupuesto son por sociedad.
2. **`parametros` (jsonb) en `componentes_plan`.** §2.6 no especifica dónde
   vive la tasa o los tramos de un componente — es la superficie de
   configuración numérica que se necesitaba para poder calcular algo.
3. **Puertas 4 y 5 colapsadas.** El endpoint `cerrar` congela los resultados
   (puerta 4) y dentro de la misma llamada dispara la generación de
   movimientos y marca el período `cerrado` (evidencia de puerta 5), en vez
   de dos pasos de usuario separados. La Fase 2 ("Gobierno", §10) es donde
   la especificación sitúa el endurecimiento completo del flujo de
   aprobaciones — este atajo es razonable para un núcleo, no para producción.
4. **Sin reglas de stacking entre campañas.** Si dos campañas publicadas
   aplican al mismo concepto en la misma fecha, el motor usa solo la primera
   que encuentra. La especificación no define qué pasa si se superponen.
5. **`pool_equipo` con `ponderado_por_dotacion`.** No hay una fuente de dotación
   real modelada todavía (no existe un concepto de "cabezas asignadas" en el
   dato maestro de Fase 1); usar esa regla de reparto sin dotación cargada
   se comporta como partes iguales.
6. **Control bloqueante #9** ("diferencia entre el total calculado y el total
   de movimientos generados") se deja siempre en 0 con una nota en el código:
   en el punto del flujo donde corren los controles (antes de congelar) los
   movimientos todavía no existen, así que no hay nada contra qué comparar
   todavía. Es una red de seguridad para una reconciliación posterior, no
   implementada aún.
7. **RLS pragmática, no exhaustiva.** Las tablas con `sociedad_id` directo
   tienen políticas por rol; `comisionados` tiene una política de inserción
   abierta (`with check (true)`) porque un comisionado puede crearse antes de
   vincularse a una sociedad. Endurecer esto es trabajo de Fase 2.
8. **Puerta 6 (acuse de pago)** tiene tabla (`acuses_nomina`) pero no
   pantalla — se puede escribir vía API/SQL directo, no hay UI todavía.
9. **Disputas (§3.10), portal del comisionado con estados (§5) y simulación
   (§3.5)** no se tocaron — quedan para Fase 2/3 según el propio plan de
   fases (§10).

## Qué no se pudo verificar

> **Actualización 2026-09-18:** esto sí se probó después contra un Supabase
> real, y encontró bugs reales (incluyendo tres tablas sin política de
> escritura). Ver [`docs/pruebas/2026-09-18-primera-prueba-real.md`](../pruebas/2026-09-18-primera-prueba-real.md).
> Lo que sigue es la advertencia original, antes de esa prueba.

No hay un proyecto Supabase real conectado a esta sesión. Se verificó:

- Compilación (`tsc --noEmit`), build de producción (`next build`) y lint,
  todos limpios.
- El motor de cálculo completo (atribución → cálculo → prorrateo diario →
  movimiento de devengo) corriendo en memoria contra datos de ejemplo
  (`npm run demo`), con las cifras verificadas a mano.
- Las páginas de login/registro renderizan correctamente en el navegador, y
  el middleware redirige `/dashboard` a `/login` cuando no hay sesión.

**No se verificó** ninguna ruta API ni página del dashboard contra una base
de datos Postgres real (RLS, triggers, y la lógica de los endpoints de
cálculo/cierre no fueron ejercitados con datos reales). Antes de usar esto
con un cliente:

1. Crear un proyecto Supabase.
2. Aplicar en orden: `supabase/schema.sql` → `supabase/seed_fase0.sql` →
   `supabase/schema_fase1.sql`.
3. Completar `.env.local` con las credenciales reales del proyecto.
4. Crear un usuario, una sociedad, y probar el flujo completo manualmente
   (o con datos de prueba) antes de confiar en los resultados.
