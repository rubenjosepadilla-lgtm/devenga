import type { Transaccion, TransaccionSplit } from '../dominio/fase1/transaccion'
import type { Credito } from '../dominio/fase1/credito'
import type { NodoJerarquia } from '../dominio/fase1/jerarquia'

/**
 * Resuelve el nodo cuyo titular es `comisionadoId`, vigente a `fecha` —
 * §2.4: "la atribución se congela con la jerarquía vigente a la fecha_credito
 * de cada transacción". Si hay varias versiones vigentes (no debería, pero los
 * datos de origen pueden ser sucios), toma la de vigencia_desde más reciente.
 */
export function nodoDelComisionadoA(nodos: NodoJerarquia[], comisionadoId: string, fecha: string): NodoJerarquia | undefined {
  return nodos
    .filter((n) => n.titular === comisionadoId)
    .filter((n) => n.vigencia_desde <= fecha && (!n.vigencia_hasta || n.vigencia_hasta >= fecha))
    .sort((a, b) => (a.vigencia_desde < b.vigencia_desde ? 1 : -1))[0]
}

/**
 * §3.2 — genera los créditos de una transacción a partir de sus splits.
 * Cada crédito guarda snapshot_jerarquia para ser reproducible aunque la
 * jerarquía cambie después (§2.4: "un cambio en el origen no reescribe
 * comisiones ya calculadas").
 */
export function atribuirCreditos(
  transaccion: Transaccion,
  splits: TransaccionSplit[],
  nodos: NodoJerarquia[],
  generarId: () => string
): Credito[] {
  const fechaCredito = transaccion.fecha_credito ?? transaccion.fecha_hecho
  const baseMonto = transaccion.monto_neto ?? transaccion.monto_bruto

  return splits.map((s) => {
    const nodo = nodoDelComisionadoA(nodos, s.comisionado_id, fechaCredito)
    return {
      id_credito: generarId(),
      transaccion_id: transaccion.id_transaccion,
      comisionado_id: s.comisionado_id,
      porcentaje_split: s.porcentaje,
      monto_atribuido: (baseMonto * s.porcentaje) / 100,
      fecha_credito: fechaCredito,
      nodo_id: nodo?.id_nodo,
      snapshot_jerarquia: nodo ?? null,
    }
  })
}
