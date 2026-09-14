# Motor de Comisiones

Motor de comisiones standalone, agnóstico a la nómina (Suel2, SAP HCM, otra, o Excel).
Ingesta transacciones comerciales, calcula el incentivo según planes versionados, clasifica
legalmente el resultado por país y lo entrega como movimientos de devengo inmutables, con
expediente reproducible por operación.

**Países v1:** Chile · Perú · Colombia · México · Argentina

El motor **clasifica e informa**; la nómina **calcula y paga**. Ver
[`docs/fase-0/00-alcance.md`](docs/fase-0/00-alcance.md) para la frontera completa.

## Estado del proyecto

**Fase 0** (§10 de la especificación): sin lógica transaccional todavía. Lo que existe:

- [`docs/fase-0/`](docs/fase-0) — matriz legal por país, catálogo de conceptos, política de
  aprobaciones y esquema del movimiento de devengo, en prosa y con las etiquetas de confianza
  de la especificación.
- [`src/lib/dominio/`](src/lib/dominio) — la misma información como tipos TypeScript y
  validaciones ejecutables (`validarConceptoUsable`, `validarMovimientoDevengo`).
- [`supabase/schema.sql`](supabase/schema.sql) + [`supabase/seed_fase0.sql`](supabase/seed_fase0.sql) —
  el mismo modelo como tablas Postgres, con los mismos CHECK/triggers bloqueantes.

Fase 1 (dato maestro completo, ingesta, atribución, cálculo, cierre — Chile primero según la
especificación, o los cinco países según se decida) todavía no está implementada.

## Setup local

1. Copia `.env.local.example` a `.env.local` y completa las variables de Supabase.
2. Ejecuta `supabase/schema.sql` y luego `supabase/seed_fase0.sql` en tu proyecto Supabase.
3. `npm install && npm run dev`

## Deploy en Vercel

1. Push a GitHub
2. Conecta el repo en vercel.com
3. Agrega las variables de entorno en Vercel Dashboard
4. Deploy automático en cada push a main
