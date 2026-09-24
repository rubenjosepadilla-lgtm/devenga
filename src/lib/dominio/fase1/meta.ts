/** Meta — §2.7. Nunca se edita: se versiona. */
export interface Meta {
  id_meta: string
  sociedad_id: string
  serie_id: string
  destino_tipo: 'comisionado' | 'nodo'
  destino_id: string
  periodo: string // yyyy-mm
  magnitud: number
  unidad: string
  version: number
  motivo_version?: string
  cargada_por: string
  aprobada_por?: string
  aprobada_en?: string
  estado: 'borrador' | 'en_aprobacion' | 'vigente' | 'superada'
}

export function validarMeta(m: Meta): string[] {
  const errores: string[] = []
  if (m.version > 1 && (!m.motivo_version || m.motivo_version.trim().length === 0)) {
    errores.push('meta corregida (version > 1) sin motivo_version — obligatorio desde la versión 2 (§2.7)')
  }
  return errores
}

/** §4.2 — controla que no existan resultados calculados contra una meta en borrador. */
export function metaBloqueaCierre(m: Meta, hayResultadosCalculados: boolean): boolean {
  return m.estado === 'borrador' && hayResultadosCalculados
}
