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

/**
 * Último día calendario real de un período "yyyy-mm" (respeta meses de 28-31
 * días y años bisiestos). Usar SIEMPRE en vez de un `-31` fijo: una fecha
 * como "2026-09-31" no existe y Postgres la rechaza con "date/time field
 * value out of range" — un error que, si no se revisa el `error` de la
 * respuesta de Supabase, deja el resto del código actuando como si
 * simplemente no hubiese datos (0 filas), no como un fallo.
 */
export function finDeMes(periodo: string): string {
  const [anio, mes] = periodo.split('-').map(Number)
  const ultimoDia = new Date(Date.UTC(anio, mes, 0)).getUTCDate()
  return `${periodo}-${String(ultimoDia).padStart(2, '0')}`
}

export function convertir(monto: number, moneda: string, monedaDestino: string, periodo: string, tiposCambio: TipoCambio[]): number {
  if (moneda === monedaDestino) return monto
  const tc = tiposCambio.find((t) => t.moneda_origen === moneda && t.moneda_destino === monedaDestino && t.periodo === periodo)
  if (!tc) {
    throw new Error(`Tipo de cambio faltante ${moneda}→${monedaDestino} para ${periodo} — bloquea el cierre (§4.2)`)
  }
  return monto * tc.tasa
}
