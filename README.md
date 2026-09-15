# Motor de Comisiones

Motor de comisiones standalone, agnóstico a la nómina (Suel2, SAP HCM, otra, o Excel).
Ingesta transacciones comerciales, calcula el incentivo según planes versionados, clasifica
legalmente el resultado por país y lo entrega como movimientos de devengo inmutables, con
expediente reproducible por operación.

**Países v1:** Chile · Perú · Colombia · México · Argentina

El motor **clasifica e informa**; la nómina **calcula y paga**. Ver
[`docs/fase-0/00-alcance.md`](docs/fase-0/00-alcance.md) para la frontera completa.

## Estado del proyecto

**Fase 0, Fase 1 (núcleo), Fase 2 (gobierno) y Fase 3 (portal y disputas)** (§10 de la
especificación), cubriendo los cinco países desde el inicio.

- [`docs/fase-0/`](docs/fase-0) — matriz legal por país, catálogo de conceptos, política de
  aprobaciones y esquema del movimiento de devengo.
- [`docs/fase-1/00-resumen.md`](docs/fase-1/00-resumen.md), [`docs/fase-2/00-resumen.md`](docs/fase-2/00-resumen.md)
  y [`docs/fase-3/00-resumen.md`](docs/fase-3/00-resumen.md) — qué se construyó en cada fase, qué
  se simplificó a propósito y qué falta verificar antes de usar esto con datos reales. **Léelos
  antes de conectar un proyecto Supabase real.**
- [`src/lib/dominio/`](src/lib/dominio) — tipos TypeScript y validaciones ejecutables.
- [`src/lib/motor/`](src/lib/motor) — el motor de cálculo como funciones puras (ingesta,
  atribución, cálculo, campañas, simulación, cierre, movimiento de devengo). `npm run demo` lo
  corre en memoria de punta a punta.
- [`supabase/schema.sql`](supabase/schema.sql) + [`seed_fase0.sql`](supabase/seed_fase0.sql) +
  [`schema_fase1.sql`](supabase/schema_fase1.sql) + [`schema_fase2.sql`](supabase/schema_fase2.sql) +
  [`schema_fase3.sql`](supabase/schema_fase3.sql) — el esquema Postgres completo.
- `src/app/dashboard/` — back-office de la sociedad. `src/app/portal/` — portal del comisionado
  (login propio en `/portal/login`). `src/app/api/` — endpoints de integración (§6), simulación
  de campañas, workflow de metas, controles bloqueantes, disputas y acuse de nómina.

Fase 4 (opinión legal firmada por país) sigue pendiente.

## Setup local

1. Copia `.env.local.example` a `.env.local` y completa las variables de un proyecto Supabase real.
2. Ejecuta, en este orden, contra ese proyecto: `supabase/schema.sql` → `supabase/seed_fase0.sql`
   → `supabase/schema_fase1.sql` → `supabase/schema_fase2.sql` → `supabase/schema_fase3.sql`.
3. `npm install && npm run dev`
4. `npm run demo` corre el motor de cálculo en memoria, sin necesidad de Supabase.

## Deploy en Vercel

1. Push a GitHub
2. Conecta el repo en vercel.com
3. Agrega las variables de entorno en Vercel Dashboard
4. Deploy automático en cada push a main
