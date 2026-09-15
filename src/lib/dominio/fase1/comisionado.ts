import type { CodigoPais } from '../tipos'

/** Comisionado — §2.3. Identidad gobernada por país; no hay identidad multipaís en v1. */
export interface Comisionado {
  id_comisionado: string
  pais: CodigoPais
  identificador_personal: string
  tipo: 'dependiente' | 'no_dependiente'
  vigencia_desde: string
  vigencia_hasta?: string
}

/** Vínculo comisionado × sociedad, versionado con vigencia (§2.3). */
export interface ComisionadoSociedad {
  id: string
  comisionado_id: string
  sociedad_id: string
  desde: string
  hasta?: string
  id_en_nomina: string
  centro_costo?: string
  rol_comercial?: string
  /** Multi-sociedad: excepción declarada (§2.3, riesgo #5 en §9). */
  participacion?: number
  participacion_motivo?: string
  participacion_aprobado_por?: string
  participacion_aprobado_en?: string
}

export function vigenteEn(rango: { desde: string; hasta?: string }, fecha: string): boolean {
  return rango.desde <= fecha && (!rango.hasta || rango.hasta >= fecha)
}

/** §2.3 riesgo #5 — multi-sociedad exige aprobación adicional explícita. */
export function validarParticipacionMultiSociedad(cs: ComisionadoSociedad): string[] {
  const errores: string[] = []
  if (cs.participacion !== undefined && cs.participacion !== null) {
    if (!cs.participacion_motivo || !cs.participacion_aprobado_por) {
      errores.push('participación entre sociedades exige motivo y aprobador explícitos (§2.3, riesgo declarado #5)')
    }
  }
  return errores
}
