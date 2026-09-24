# Esquema del movimiento de devengo

Fuente: §3.8 (objeto), §1.3 (los dos períodos) y §0.3 (regla de desagregación diaria) de la
especificación funcional v1.

Contraparte ejecutable: [`src/lib/dominio/movimiento-devengo.ts`](../../src/lib/dominio/movimiento-devengo.ts)
(`MovimientoDevengo`, `AcuseNomina`, `validarMovimientoDevengo`) y
`supabase/movimientos_devengo`, `acuses_nomina` en [`supabase/schema.sql`](../../supabase/schema.sql).

## El objeto

Es el **único** objeto de entrega a nómina (ida). Un solo contrato de datos para los tres modos
de integración (API, archivo, Excel — §6).

| Campo | Notas |
|---|---|
| `id_movimiento` | Único, inmutable |
| `comisionado`, `sociedad`, `pais` | |
| `concepto`, `mapeo_nomina` | |
| `importe`, `moneda` | |
| `periodo_origen`, `periodo_imputacion` | Ver "los dos períodos" abajo |
| `devengo_diario`, `detalle_diario[]` | Obligatorio si `devengo_diario = true` |
| `caracter`, `remunerativo`, `incide_en[]` | La clasificación legal viaja con el importe |
| `hash_detalle` | Huella del expediente que lo respalda |
| `url_documento` | Documento publicado al trabajador |
| `estado` | enviado / acusado / pagado / rechazado |

## Los dos períodos (§1.3)

| Campo | Significado |
|---|---|
| `periodo_origen` | Período al que pertenece el hecho. Determina el tratamiento legal |
| `periodo_imputacion` | Período de nómina en que se entrega. Determina cuándo se paga |

En el caso normal son iguales. Cuando difieren, el movimiento es una corrección. **El motor
nunca reemite un período; emite movimientos nuevos** (§3.11 — no hay reapertura).

## La regla no obvia (§0.3)

> Todo concepto marcado `devengo_diario = true` se entrega obligatoriamente desagregado por
> día. No es opción de configuración.

Sin esa desagregación ninguna nómina puede calcular semana corrida (Chile), el promedio
bimestral (México) o identificar el mes de mayor remuneración (Argentina) correctamente. Por
eso `validarMovimientoDevengo()` y el CHECK `devengo_diario_exige_detalle` en SQL bloquean
cualquier movimiento que declare `devengo_diario = true` sin `detalle_diario[]`, y verifican
que la suma del detalle diario coincida con el importe total.

## Acuse de nómina (§3.9) — la vuelta

Mínimo acordado: `id_movimiento`, `periodo_liquidado`, `monto_bruto_pagado`, `estado`,
`id_documento_publicado`, `fecha`.

Sin acuse, el movimiento queda en estado *enviado* y el portal muestra "aprobado, pendiente de
pago" — nunca "pagado".

**Modo Excel:** el acuse es manual y se registra como *declarado*, no *confirmado*
(`declarado_no_confirmado = true`). La cadena de evidencia queda coja en ese tramo y así se
declara en el contrato — limitación declarada, no defecto oculto.
