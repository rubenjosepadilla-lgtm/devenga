/** Disputa — §3.10. Flujo obligatorio: apertura → clasificación → asignación → SLA → resolución → ajuste si procede. */

export type ReferenciaDisputa = 'concepto' | 'operacion'
export type ClasificacionDisputa = 'atribucion' | 'monto' | 'meta' | 'campana' | 'plan' | 'pago'
export type EstadoDisputa = 'abierta' | 'asignada' | 'en_resolucion' | 'resuelta' | 'rechazada'

export interface Disputa {
  id: string
  comisionado_id: string
  sociedad_id: string
  referencia_tipo: ReferenciaDisputa
  referencia_id: string
  clasificacion: ClasificacionDisputa
  descripcion: string
  estado: EstadoDisputa
  asignado_a?: string
  sla_vence_en: string
  resuelta_por?: string
  resuelta_en?: string
  motivo_resolucion?: string
  genera_ajuste: boolean
}

/**
 * SLA en días corridos por tipo de disputa. La especificación exige "SLA por
 * tipo" (§3.10) pero no fija los plazos — son un supuesto de producto,
 * ajustable sin tocar el flujo.
 */
export const SLA_DIAS_POR_CLASIFICACION: Record<ClasificacionDisputa, number> = {
  atribucion: 5,
  monto: 5,
  meta: 3,
  campana: 3,
  plan: 7,
  pago: 2,
}

export function calcularSlaVenceEn(clasificacion: ClasificacionDisputa, desde: Date): Date {
  const vence = new Date(desde)
  vence.setDate(vence.getDate() + SLA_DIAS_POR_CLASIFICACION[clasificacion])
  return vence
}

export function slaVencido(disputa: Pick<Disputa, 'estado' | 'sla_vence_en'>, ahora: Date): boolean {
  return disputa.estado !== 'resuelta' && disputa.estado !== 'rechazada' && new Date(disputa.sla_vence_en) < ahora
}
