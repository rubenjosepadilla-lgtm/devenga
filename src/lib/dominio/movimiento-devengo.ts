import type { CodigoPais } from './tipos'
import type { Caracter } from './conceptos'

/**
 * Movimiento de devengo — §3.8. Es el único objeto de entrega a nómina (ida).
 * Inmutable: una corrección nunca reemite este objeto, genera uno nuevo (§1.3, §3.11).
 */

export type EstadoMovimiento = 'enviado' | 'acusado' | 'pagado' | 'rechazado'

export interface DetalleDiario {
  fecha: string // ISO yyyy-mm-dd
  importe: number
}

export interface MovimientoDevengo {
  id_movimiento: string
  comisionado: string
  sociedad: string
  pais: CodigoPais
  concepto: string // codigo del Concepto
  mapeo_nomina: string
  importe: number
  moneda: string

  /** Período al que pertenece el hecho — determina el tratamiento legal (§1.3) */
  periodo_origen: string // yyyy-mm
  /** Período de nómina en que se entrega — determina cuándo se paga (§1.3) */
  periodo_imputacion: string // yyyy-mm

  devengo_diario: boolean
  /** Obligatorio, no opcional, cuando devengo_diario = true (§0.3) */
  detalle_diario?: DetalleDiario[]

  caracter: Caracter
  remunerativo: boolean
  incide_en: string[]

  /** Huella del expediente que respalda el importe */
  hash_detalle: string
  /** Documento publicado al trabajador */
  url_documento: string

  estado: EstadoMovimiento
}

/** §3.9 — acuse desde la nómina (vuelta). Mínimo acordado. */
export interface AcuseNomina {
  id_movimiento: string
  periodo_liquidado: string
  monto_bruto_pagado: number
  estado: EstadoMovimiento
  id_documento_publicado: string
  fecha: string
  /** true solo en modo Excel: registrado como "declarado", no "confirmado" (§3.9) */
  declarado_no_confirmado?: boolean
}

/**
 * Validación bloqueante del movimiento antes de entregarlo a nómina.
 * Ver también §4.2 (controles bloqueantes de cierre de período).
 */
export function validarMovimientoDevengo(m: MovimientoDevengo): string[] {
  const errores: string[] = []

  if (m.devengo_diario) {
    if (!m.detalle_diario || m.detalle_diario.length === 0) {
      errores.push('devengo_diario = true exige detalle_diario[] poblado — no es opción de configuración (§0.3)')
    } else {
      const suma = m.detalle_diario.reduce((acc, d) => acc + d.importe, 0)
      if (Math.abs(suma - m.importe) > 0.01) {
        errores.push(`detalle_diario no suma el importe total: ${suma} ≠ ${m.importe}`)
      }
    }
  }

  if (!m.incide_en || m.incide_en.length === 0) {
    errores.push('incide_en[] vacío — el movimiento no puede viajar sin su clasificación legal (§2.5, §3.8)')
  }

  if (m.periodo_origen !== m.periodo_imputacion) {
    // Es una corrección: válida, pero exige que exista un movimiento previo asociado.
    // La verificación de existencia se hace contra el store, no aquí.
  }

  return errores
}
