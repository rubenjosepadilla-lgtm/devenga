import type { Campana } from '../dominio/fase1/campana'
import { campanaCalcula } from '../dominio/fase1/campana'

/**
 * Aplica una campaña vigente y publicada sobre un importe ya calculado.
 * Una campaña no publicada nunca modifica el resultado (§2.8 regla 3).
 */
export function aplicarCampana(importeBase: number, campana: Campana): number {
  if (!campanaCalcula(campana)) return importeBase
  if (campana.multiplicador !== undefined) return importeBase * campana.multiplicador
  if (campana.monto !== undefined) return importeBase + campana.monto
  return importeBase
}

/** Filtra campañas cuya vigencia_hecho cubre la fecha del hecho y que efectivamente calculan. */
export function campanasAplicablesA(campanas: Campana[], conceptoCodigo: string, fechaHecho: string): Campana[] {
  return campanas.filter(
    (c) =>
      c.concepto_codigo === conceptoCodigo &&
      campanaCalcula(c) &&
      c.vigencia_hecho_desde <= fechaHecho &&
      c.vigencia_hecho_hasta >= fechaHecho
  )
}
