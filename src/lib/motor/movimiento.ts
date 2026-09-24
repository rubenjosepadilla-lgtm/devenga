import { createHash } from 'node:crypto'
import type { Concepto } from '../dominio/conceptos'
import type { ResultadoCalculo } from '../dominio/fase1/resultado'
import type { MovimientoDevengo } from '../dominio/movimiento-devengo'
import { validarMovimientoDevengo } from '../dominio/movimiento-devengo'

/**
 * §3.8 — construye el movimiento de devengo desde un resultado de cálculo ya
 * congelado. El hash_detalle es la huella del expediente (snapshot + créditos)
 * que respalda el importe; permite detectar si el expediente fue alterado.
 */
export function construirMovimientoDevengo(params: {
  resultado: ResultadoCalculo
  concepto: Concepto
  comisionadoId: string
  sociedadId: string
  periodoOrigen: string
  periodoImputacion: string
  urlDocumento: string
  generarId: () => string
}): { movimiento: MovimientoDevengo; errores: string[] } {
  const { resultado, concepto, comisionadoId, sociedadId, periodoOrigen, periodoImputacion, urlDocumento, generarId } = params

  const hashDetalle = createHash('sha256')
    .update(JSON.stringify({ resultado_id: resultado.id_resultado, snapshot: resultado.snapshot, importe: resultado.importe }))
    .digest('hex')

  const movimiento: MovimientoDevengo = {
    id_movimiento: generarId(),
    comisionado: comisionadoId,
    sociedad: sociedadId,
    pais: concepto.pais,
    concepto: concepto.codigo,
    mapeo_nomina: concepto.mapeo_nomina ?? concepto.codigo,
    importe: resultado.importe,
    moneda: resultado.moneda,
    periodo_origen: periodoOrigen,
    periodo_imputacion: periodoImputacion,
    devengo_diario: concepto.devengo_diario,
    detalle_diario: resultado.detalle_diario,
    caracter: concepto.caracter,
    remunerativo: concepto.remunerativo,
    incide_en: concepto.incide_en,
    hash_detalle: hashDetalle,
    url_documento: urlDocumento,
    estado: 'enviado',
  }

  return { movimiento, errores: validarMovimientoDevengo(movimiento) }
}

/**
 * §3.11 — corrección de un período cerrado: nunca se reemite, se genera un
 * movimiento nuevo con periodo_origen del hecho y periodo_imputacion del
 * período abierto. Conserva la clasificación legal del concepto original
 * (`devengo_diario`, `incide_en`, etc.) — una corrección no cambia lo que el
 * concepto es, así que si el concepto exige detalle diario, el ajuste también
 * debe traerlo (el llamador lo provee; si no puede, `validarMovimientoDevengo`
 * lo bloqueará en vez de degradarlo en silencio a mensual).
 */
export function construirMovimientoCorreccion(params: {
  original: MovimientoDevengo
  importeAjuste: number
  periodoImputacionAbierto: string
  detalleDiarioAjuste?: MovimientoDevengo['detalle_diario']
  generarId: () => string
}): { movimiento: MovimientoDevengo; errores: string[] } {
  const { original, importeAjuste, periodoImputacionAbierto, detalleDiarioAjuste, generarId } = params
  const movimiento: MovimientoDevengo = {
    ...original,
    id_movimiento: generarId(),
    importe: importeAjuste,
    periodo_imputacion: periodoImputacionAbierto,
    detalle_diario: detalleDiarioAjuste,
    estado: 'enviado',
  }
  return { movimiento, errores: validarMovimientoDevengo(movimiento) }
}
