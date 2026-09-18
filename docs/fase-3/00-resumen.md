# Fase 3 — Portal y disputas

Cubre §10 "Fase 3 — Portal y disputas" de la especificación: portal con
estados, documento del comisionado, disputas con SLA, y acuse de nómina.

## Qué se construyó

- **Login del comisionado** (`/portal/register`, `/portal/login`) — no está en
  el texto literal de la especificación, que no define un mecanismo de
  autenticación concreto para el portal (§5). `comisionados.usuario_id`
  vincula un `auth.users` a un comisionado. Por seguridad, la vinculación es
  una acción de **staff**, no autoservicio: el comisionado crea una cuenta
  simple (email/contraseña) y alguien de la sociedad la vincula desde
  Comisionados → "Vincular portal" buscando por email — dejar que el
  comisionado "reclame" su registro escribiendo su propio identificador
  personal habría sido inseguro (esos identificadores no son secretos).
- **Portal** (`/portal`) — metas vigentes con avance, campañas publicadas,
  historial de comisiones con estado. Estados reales soportados:
  `estimado_provisional`, `enviado_a_nomina`, `pagado` — ver la simplificación
  #1 abajo sobre por qué `calculado`/`aprobado` de §5 no son observables hoy.
- **Documento del comisionado** (`/documentos/[id]`, §3.7) — concepto,
  importe, método de cálculo, metas, desagregación diaria y las operaciones
  (créditos) que originaron el importe. Cierra el placeholder que Fase 1
  había dejado en `url_documento`. Accesible tanto por el comisionado dueño
  del resultado como por el staff de la sociedad (RLS).
- **Disputas** (§3.10) — tabla `disputas` con el flujo completo: apertura
  desde el portal (`POST /api/disputas`, con SLA calculado según
  `SLA_DIAS_POR_CLASIFICACION` en `src/lib/dominio/fase3/disputa.ts`) →
  asignación (`POST /api/disputas/[id]/asignar`) → resolución con motivo
  obligatorio (`POST /api/disputas/[id]/resolver`), con marca `genera_ajuste`
  cuando corresponde. UI en `/portal/disputas` (comisionado) y
  `/dashboard/disputas` (staff, con SLA vencido resaltado).
- **Acuse de nómina** (§3.9, puerta 6) — `POST /api/movimientos/[id]/acuse`
  desde la página del período, registra el acuse y actualiza el estado del
  movimiento.
- **Corrección de seguridad heredada de Fase 1**: `movimientos_devengo` se
  creó en `schema.sql` (Fase 0) sin RLS — no existía todavía el concepto de
  sociedad/comisionado. Quedó así durante Fase 1 y Fase 2 sin que nadie lo
  notara. `schema_fase3.sql` lo corrige. También se completa el FK real de
  `comisionado`/`sociedad` en esa tabla (antes texto suelto, comentado como
  pendiente desde Fase 0).

## Simplificaciones declaradas

1. **Solo tres estados de portal son observables.** §5 define cinco:
   `estimado provisional` → `calculado` → `aprobado` → `enviado a nómina` →
   `pagado`. La Fase 1 colapsó las puertas 4 y 5 (congelar + generar
   movimientos + cerrar el período ocurren en una sola llamada) — así que
   `calculado` y `aprobado` no son estados que un resultado atraviese de
   forma distinguible todavía. Separar esas puertas es un rediseño del motor
   de cierre, no un cambio del portal.
2. **Vínculo comisionado↔usuario es 1:1 y manual.** No hay flujo de invitación
   por link (como el `/invite/[token]` de Doqit); el staff busca por email
   exacto. Un comisionado con varias sociedades (§2.3, riesgo #5) solo puede
   tener una cuenta de portal.
3. **Disputas: el ajuste no se genera automáticamente.** `genera_ajuste=true`
   deja la marca, pero crear el movimiento de corrección real (§3.11) sigue
   siendo una acción manual de otra pantalla — no hay automatismo que
   conecte la resolución de una disputa con la emisión del ajuste.
4. **El acuse no valida contra el movimiento original.** `POST /api/movimientos/[id]/acuse`
   no compara `monto_bruto_pagado` contra el importe del movimiento — un
   acuse con un monto distinto se acepta igual. Esa reconciliación queda
   pendiente.

## Qué no se pudo verificar

> **Actualización 2026-09-18:** ver [`docs/pruebas/2026-09-18-primera-prueba-real.md`](../pruebas/2026-09-18-primera-prueba-real.md) —
> el flujo de comisionado/ingesta/cálculo/cierre/documento/acuse sí se probó
> después contra un Supabase real. El portal del comisionado en sí
> (`/portal/login`, `/portal/register`, disputas) sigue sin probarse. Lo que
> sigue es la advertencia original, antes de esa prueba.

Como en las fases anteriores, sin un proyecto Supabase real conectado a esta
sesión no se pudo probar ningún flujo contra Postgres. Se verificó
compilación, build y lint limpios. La verificación visual en navegador de
`/portal/login` y `/portal/register` **no pudo completarse esta vez** — el
entorno de navegador de la sesión rechazó la navegación a `localhost` en este
intento (a diferencia de Fase 1, donde sí se pudo verificar `/login` y
`/register` visualmente). El código sigue el mismo patrón ya verificado
entonces; aun así, antes de usar el portal con un comisionado real, confirma
visualmente que `/portal/login` y `/portal/register` renderizan bien.

Antes de confiar en esto con datos reales: aplica `supabase/schema_fase3.sql`
sobre un proyecto con Fase 0, 1 y 2 ya aplicadas, y prueba manualmente: un
comisionado se registra en `/portal/register`, el staff lo vincula desde
`/dashboard/comisionados`, el comisionado ve sus metas y campañas en
`/portal`, abre una disputa, el staff la asigna y resuelve, y el staff
registra un acuse de nómina para un movimiento cerrado.
