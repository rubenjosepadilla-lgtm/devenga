/** Jerarquía y territorio — §2.4. Propio del motor, nunca espejo en vivo de HR/CRM. */
export interface NodoJerarquia {
  id_nodo: string
  sociedad_id: string
  tipo: 'equipo' | 'celula' | 'zona' | 'canal' | 'territorio'
  nodo_padre?: string
  titular?: string
  vigencia_desde: string
  vigencia_hasta?: string
  motivo_cambio: string
  aprobado_por: string
  aprobado_en: string
  /** Excepción configurable de §2.4 — por defecto, congela a la fecha_credito de cada crédito. */
  tratamiento_corte: 'congelado_a_fecha_credito' | 'mes_completo_saliente' | 'mes_completo_entrante'
}

/**
 * Resuelve el nodo (y por tanto el titular) vigente para una fecha_credito
 * dada, dentro del árbol de nodos de una sociedad — §2.4: "la atribución se
 * congela con la jerarquía vigente a la fecha_credito de cada transacción".
 */
export function nodoVigenteA(nodos: NodoJerarquia[], idNodo: string, fechaCredito: string): NodoJerarquia | undefined {
  const versiones = nodos
    .filter((n) => n.id_nodo === idNodo || (n.nodo_padre === undefined && false))
    .filter((n) => n.vigencia_desde <= fechaCredito && (!n.vigencia_hasta || n.vigencia_hasta >= fechaCredito))
  return versiones.sort((a, b) => (a.vigencia_desde < b.vigencia_desde ? 1 : -1))[0]
}

export function validarNodoJerarquia(n: NodoJerarquia): string[] {
  const errores: string[] = []
  if (!n.motivo_cambio || n.motivo_cambio.trim().length < 10) {
    errores.push('motivo_cambio ausente o insuficiente — todo cambio de jerarquía exige motivo (§2.4)')
  }
  if (!n.aprobado_por || !n.aprobado_en) {
    errores.push('nodo de jerarquía sin aprobación registrada (§2.4)')
  }
  return errores
}
