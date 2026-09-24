# Catálogo de conceptos

Fuente: §2.5 de la especificación funcional v1. El concepto es el objeto central del
producto: cada importe que sale del motor pertenece a un concepto, y el concepto lleva su
clasificación legal.

Contraparte ejecutable: [`src/lib/dominio/conceptos.ts`](../../src/lib/dominio/conceptos.ts)
(`Concepto`, `CATALOGO_CONCEPTOS`, `validarConceptoUsable`) y `supabase/conceptos`
(sembradas en [`supabase/seed_fase0.sql`](../../supabase/seed_fase0.sql)).

## Campos

| Campo | Notas |
|---|---|
| `naturaleza` | comisión · premio · spif · override · bono_meta · ajuste |
| `base_devengo` | unidad_vendida · meta_individual · meta_grupal · mixta |
| `evento_devengo` | firma · despacho · facturación · cobro · otro |
| `devengo_diario` | **true / false + fundamento textual obligatorio (≥20 caracteres)** |
| `caracter` | principal/accesorio · ordinario/extraordinario |
| `remunerativo` | integra o no la base de seguridad social |
| `incide_en[]` | beneficios derivados, deben existir en la matriz legal del país |
| `granularidad_entrega` | diaria / mensual — forzada a diaria si `devengo_diario` |
| `reversible` | + causales permitidas |
| `mapeo_nomina` | wage type / código de haber en el sistema destino |

## Validación bloqueante

Un concepto sin `devengo_diario` resuelto y sin `incide_en[]` poblado **no puede usarse en un
plan**. No hay valor por defecto. Es la única forma de impedir que el cliente cree un premio y
descubra su costo laboral seis meses después.

Implementada en tres capas redundantes (documentación → aplicación → base de datos), porque es
la validación más importante del producto:

1. **App:** `validarConceptoUsable()` en `conceptos.ts` — valida fundamento (≥20 caracteres),
   `incide_en[]` no vacío y referenciando beneficios reales de la matriz legal del país, y
   coherencia `devengo_diario` ↔ `granularidad_entrega`.
2. **DB (CHECK):** `devengo_diario_fuerza_granularidad`, `fundamento_no_trivial`,
   `cl_bloquea_evento_cobro` en `supabase/schema.sql`.
3. **DB (trigger):** `trg_concepto_incide_en_no_vacio` — un `text[]` no admite `NOT NULL` sobre
   "no vacío" vía CHECK simple de forma legible, así que se refuerza con trigger.

## Nota de diseño legal (Chile)

El criterio de la Dirección del Trabajo exige que la remuneración variable sea devengada
diariamente, principal y ordinaria para entrar a la base de semana corrida, y niega el
beneficio a las comisiones mensuales sobre venta neta del establecimiento repartidas entre
vendedores **[Seguro]**. Existe doctrina que sostiene que una remuneración condicionada a meta
se entiende devengada diariamente una vez cumplida la condición **[Probable — zona gris;
requiere opinión firmada por laboralista]**. El motor no resuelve la controversia: obliga a
declarar la postura, la registra con fundamento y la aplica de forma consistente y auditable.

Los conceptos semilla `CL-COM-VENTA` y `CL-PREMIO-META-MENSUAL` son el ejemplo mínimo de esa
disyuntiva: mismo país, mismo tipo de venta subyacente, tratamiento de semana corrida opuesto
según si la comisión es individual y diaria o un premio mensual repartido.

## Catálogo semilla (representativo, no exhaustivo)

| Código | País | Naturaleza | `devengo_diario` | `incide_en` |
|---|---|---|---|---|
| `CL-COM-VENTA` | CL | comisión | true | semana_corrida, gratificación, feriado, indemnizaciones, base_imponible |
| `CL-PREMIO-META-MENSUAL` | CL | bono_meta | false | gratificación, base_imponible |
| `PE-COM-PRINCIPAL` | PE | comisión | true | cts, gratificaciones, vacaciones, cts_al_cese |
| `CO-COM-VENTA` | CO | comisión | true | prima, cesantías, intereses_cesantías, vacaciones, ibc, indemnización |
| `MX-COM-VENTA` | MX | comisión | true | sbc_imss, aguinaldo, prima_vacacional, indemnización |
| `AR-COM-VENTA` | AR | comisión | true | sac, vacaciones, indemnización |

Cada cliente real amplía este catálogo con sus propios conceptos (SPIF, overrides de
jerarquía, campañas) — todos pasan por la misma validación bloqueante antes de poder asignarse
a un plan.
