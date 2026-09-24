import type { CodigoPais } from '../tipos'

/** Fuente y mapeo de transacciones — §2.9. */
export interface Fuente {
  id_fuente: string
  sociedad_id: string
  sistema: string
  modo: 'api' | 'archivo' | 'manual'
  mapeo_campos: Record<string, string>
  politica_duplicados: 'rechazar' | 'actualizar' | 'versionar'
  ventana_aceptacion_dias: number
}

export type TipoEventoTransaccion = 'firma' | 'despacho' | 'factura' | 'cobro' | 'nota_credito'

/** Transacción comisionable — §2.10. */
export interface Transaccion {
  id_transaccion: string
  id_externo?: string
  fuente_id: string
  sociedad_id: string
  pais: CodigoPais
  fecha_hecho: string
  fecha_credito?: string
  tipo_evento: TipoEventoTransaccion
  cliente?: string
  producto?: string
  canal?: string
  territorio?: string
  monto_bruto: number
  monto_neto?: number
  margen?: number
  unidades?: number
  moneda: string
  estado: 'valida' | 'anulada' | 'en_revision'
  hash_origen: string
  clave_natural: string
}

export interface TransaccionSplit {
  comisionado_id: string
  porcentaje: number
}

export interface RegistroCuarentena {
  fuente_id: string
  payload: unknown
  motivo: string
}

/** §3.1 — validaciones de ingesta. Cualquier falla manda el registro a cuarentena, nunca lo descarta. */
export function validarIngesta(params: {
  transaccion: Omit<Transaccion, 'id_transaccion'>
  splits: TransaccionSplit[]
  fuente: Fuente
  comisionadoVigente: (comisionadoId: string, fecha: string) => boolean
  monedaConocida: (moneda: string) => boolean
  hoy: string
}): string[] {
  const { transaccion: t, splits, fuente, comisionadoVigente, monedaConocida, hoy } = params
  const motivos: string[] = []

  const diasAntiguedad = Math.floor((Date.parse(hoy) - Date.parse(t.fecha_hecho)) / 86_400_000)
  if (diasAntiguedad > fuente.ventana_aceptacion_dias) {
    motivos.push(`fuera de ventana_aceptacion (${diasAntiguedad} días > ${fuente.ventana_aceptacion_dias})`)
  }

  if (!monedaConocida(t.moneda)) {
    motivos.push(`moneda desconocida: ${t.moneda}`)
  }

  const sumaSplits = splits.reduce((acc, s) => acc + s.porcentaje, 0)
  if (Math.abs(sumaSplits - 100) > 0.001) {
    motivos.push(`split no suma 100% (suma = ${sumaSplits})`)
  }

  for (const s of splits) {
    if (!comisionadoVigente(s.comisionado_id, t.fecha_credito ?? t.fecha_hecho)) {
      motivos.push(`comisionado ${s.comisionado_id} sin vínculo laboral vigente a la fecha`)
    }
  }

  // §3.4 / cl_bloquea_evento_cobro — ya bloqueado en DB; se repite aquí para
  // dar el motivo de cuarentena legible antes de intentar el insert.
  if (t.pais === 'CL' && t.tipo_evento === 'cobro') {
    motivos.push('Chile bloquea el evento_devengo "cobro" (§3.4)')
  }

  return motivos
}
