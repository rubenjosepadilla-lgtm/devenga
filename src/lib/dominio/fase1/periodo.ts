/** Calendario de períodos — §2.11, §3.6. */
export type EstadoPeriodo = 'abierto' | 'en_calculo' | 'congelado' | 'cerrado'

export interface Periodo {
  id: string
  sociedad_id: string
  periodo: string // yyyy-mm
  fecha_apertura: string
  fecha_corte: string
  estado: EstadoPeriodo
  congelado_en?: string
  congelado_hash?: string
  cerrado_en?: string
  cerrado_por?: string
}

export interface TipoCambio {
  moneda_origen: string
  moneda_destino: string
  periodo: string
  tasa: number
  fuente: string
  fecha: string
}

export function convertir(monto: number, moneda: string, monedaDestino: string, periodo: string, tiposCambio: TipoCambio[]): number {
  if (moneda === monedaDestino) return monto
  const tc = tiposCambio.find((t) => t.moneda_origen === moneda && t.moneda_destino === monedaDestino && t.periodo === periodo)
  if (!tc) {
    throw new Error(`Tipo de cambio faltante ${moneda}→${monedaDestino} para ${periodo} — bloquea el cierre (§4.2)`)
  }
  return monto * tc.tasa
}
