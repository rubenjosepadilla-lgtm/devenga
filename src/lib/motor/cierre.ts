import { CONTROLES_BLOQUEANTES } from '../dominio/aprobaciones'

/**
 * §4.2 — controles bloqueantes de cierre de período. No es posible cerrar un
 * período si existe alguno de los diez controles de CONTROLES_BLOQUEANTES.
 * Esta función no consulta la base de datos: recibe agregados ya calculados
 * por el llamador (típicamente una API route) y decide qué controles violan.
 */
export interface InsumosCierre {
  transaccionesEnCuarentenaSinResolver: number
  splitsQueNoSuman100: { transaccionId: string; suma: number }[]
  comisionadosSinVinculoVigente: { comisionadoId: string; fecha: string }[]
  conceptosNoUsables: { codigo: string; errores: string[] }[]
  campanasPublicadasSinAutorizacion: { id: string }[]
  overridesSinMotivoOAprobador: { id: string }[]
  metasBorradorConResultados: { id_meta: string }[]
  monedasSinTipoCambio: string[]
  diferenciaCalculadoVsMovimientos: number
  campanasQueExcedenPresupuesto: { id: string; proyectado: number; tope: number }[]
}

export interface ViolacionControl {
  control: string
  detalle: string
}

export function evaluarControlesBloqueantes(i: InsumosCierre): ViolacionControl[] {
  const violaciones: ViolacionControl[] = []

  if (i.transaccionesEnCuarentenaSinResolver > 0) {
    violaciones.push({ control: CONTROLES_BLOQUEANTES[0], detalle: `${i.transaccionesEnCuarentenaSinResolver} transacción(es) en cuarentena` })
  }
  if (i.splitsQueNoSuman100.length > 0) {
    violaciones.push({ control: CONTROLES_BLOQUEANTES[1], detalle: i.splitsQueNoSuman100.map((s) => `${s.transaccionId}: ${s.suma}%`).join(', ') })
  }
  if (i.comisionadosSinVinculoVigente.length > 0) {
    violaciones.push({ control: CONTROLES_BLOQUEANTES[2], detalle: i.comisionadosSinVinculoVigente.map((c) => c.comisionadoId).join(', ') })
  }
  if (i.conceptosNoUsables.length > 0) {
    violaciones.push({ control: CONTROLES_BLOQUEANTES[3], detalle: i.conceptosNoUsables.map((c) => `${c.codigo}: ${c.errores.join('; ')}`).join(' | ') })
  }
  if (i.campanasPublicadasSinAutorizacion.length > 0) {
    violaciones.push({ control: CONTROLES_BLOQUEANTES[4], detalle: i.campanasPublicadasSinAutorizacion.map((c) => c.id).join(', ') })
  }
  if (i.overridesSinMotivoOAprobador.length > 0) {
    violaciones.push({ control: CONTROLES_BLOQUEANTES[5], detalle: i.overridesSinMotivoOAprobador.map((o) => o.id).join(', ') })
  }
  if (i.metasBorradorConResultados.length > 0) {
    violaciones.push({ control: CONTROLES_BLOQUEANTES[6], detalle: i.metasBorradorConResultados.map((m) => m.id_meta).join(', ') })
  }
  if (i.monedasSinTipoCambio.length > 0) {
    violaciones.push({ control: CONTROLES_BLOQUEANTES[7], detalle: i.monedasSinTipoCambio.join(', ') })
  }
  if (Math.abs(i.diferenciaCalculadoVsMovimientos) > 0.01) {
    violaciones.push({ control: CONTROLES_BLOQUEANTES[8], detalle: `diferencia = ${i.diferenciaCalculadoVsMovimientos}` })
  }
  if (i.campanasQueExcedenPresupuesto.length > 0) {
    violaciones.push({
      control: CONTROLES_BLOQUEANTES[9],
      detalle: i.campanasQueExcedenPresupuesto.map((c) => `${c.id}: ${c.proyectado} > ${c.tope}`).join(', '),
    })
  }

  return violaciones
}

export function puedeCerrarPeriodo(i: InsumosCierre): boolean {
  return evaluarControlesBloqueantes(i).length === 0
}
