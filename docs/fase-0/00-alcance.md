# Alcance y frontera

Fuente: §0 de la especificación funcional v1 (14-sep-2026).

## Qué es

Un motor que ingesta transacciones comerciales, las atribuye a comisionados, calcula el
incentivo según planes versionados, **clasifica legalmente el resultado por país** y lo
entrega a una nómina cualquiera (Suel2, SAP HCM, otra, o Excel) como movimientos de devengo
inmutables, con un expediente reproducible por operación.

## Qué no hace, y por qué

| No hace | Razón |
|---|---|
| No calcula semana corrida, gratificación, CTS, SDI, SAC ni finiquito | Esos cálculos necesitan días trabajados, ausencias, licencias y topes que solo tiene la nómina |
| No emite liquidación de sueldo | Es documento de la nómina |
| No es CRM ni sistema de ventas | No origina la transacción |
| No paga | No mueve dinero |
| No corrige períodos cerrados | No hay reapertura — genera movimientos nuevos (§3.11) |

**Regla única:** el motor **clasifica e informa**; la nómina **calcula y paga**.

## La consecuencia no obvia

En Chile, la semana corrida se calcula sobre lo devengado diariamente. La nómina conoce los
días; **solo el motor conoce el importe diario del variable**. Por eso:

> Todo concepto marcado `devengo_diario = true` se entrega **obligatoriamente** desagregado
> por día. No es opción de configuración (ver [`04-esquema-movimiento-devengo.md`](./04-esquema-movimiento-devengo.md)).

Lo mismo aplica, con otra granularidad, a México (promedio bimestral por días devengados) y
a Argentina (identificación del mes de mayor remuneración) — ver
[`01-matriz-legal.md`](./01-matriz-legal.md).

## Contraparte ejecutable

- `src/lib/dominio/tipos.ts` — países v1 y tipos comunes
- `supabase/schema.sql` — tablas `paises`
