import type { Concepto } from '../dominio/conceptos'
import type { Transaccion, TransaccionSplit } from '../dominio/fase1/transaccion'
import type { NodoJerarquia } from '../dominio/fase1/jerarquia'
import type { PlantillaPlan, ComponentePlan, AsignacionPlan } from '../dominio/fase1/plan'
import type { Meta } from '../dominio/fase1/meta'
import type { Campana } from '../dominio/fase1/campana'
import type { Credito } from '../dominio/fase1/credito'
import type { TipoCambio } from '../dominio/fase1/periodo'
import type { ResultadoCalculo } from '../dominio/fase1/resultado'
import type { DetalleDiario } from '../dominio/movimiento-devengo'
import { atribuirCreditos } from './atribucion'
import { calcularComponente, calcularPoolEquipo, aplicarTope, prorratearPorCreditos } from './calculo'
import { campanasAplicablesA, aplicarCampana } from './campana'
import { convertir, finDeMes } from '../dominio/fase1/periodo'

/**
 * §3.3 — orquesta el cálculo completo de un período: atribución → cálculo
 * por componente en orden_evaluacion → campañas → topes → conversión de
 * moneda → resultados. Función pura: no toca la base de datos, para poder
 * probarse sin ella (ver scripts/demo-motor.ts).
 *
 * Cobertura declarada: implementa a fondo tasa_lineal, escalonado_marginal,
 * escalonado_total, multiplicador_por_logro y monto_fijo_por_hito (el grueso
 * real de cualquier plan de comisiones). override_jerarquia, pool_equipo y
 * un componente de tipo 'campaña' están soportados con simplificaciones
 * señaladas en línea — no hay reglas de stacking entre campañas (se aplica
 * la primera que matchea) ni traspaso de dotación real para pool_equipo.
 */

export interface InsumosPeriodo {
  periodoId: string
  periodo: string // yyyy-mm
  sociedadId: string
  monedaSociedad: string
  transacciones: Transaccion[]
  splitsPorTransaccion: Record<string, TransaccionSplit[]>
  nodos: NodoJerarquia[]
  plantillas: PlantillaPlan[]
  componentes: ComponentePlan[]
  asignaciones: AsignacionPlan[]
  metas: Meta[]
  campanas: Campana[]
  tiposCambio: TipoCambio[]
  conceptos: Concepto[]
  generarId: () => string
}

export interface ResultadoOrquestacion {
  creditos: Credito[]
  resultados: ResultadoCalculo[]
  errores: { destino_id: string; componente_id: string; mensaje: string }[]
}

function metaVigente(metas: Meta[], destinoTipo: string, destinoId: string, periodo: string): Meta | undefined {
  return metas.find((m) => m.destino_tipo === destinoTipo && m.destino_id === destinoId && m.periodo === periodo && m.estado === 'vigente')
}

function filtraElegibles(creditos: Credito[], transaccionesPorId: Map<string, Transaccion>, filtro?: Record<string, unknown>): Credito[] {
  if (!filtro || Object.keys(filtro).length === 0) return creditos
  return creditos.filter((c) => {
    const t = transaccionesPorId.get(c.transaccion_id)
    if (!t) return false
    if (filtro.producto && t.producto !== filtro.producto) return false
    if (filtro.canal && t.canal !== filtro.canal) return false
    if (filtro.cliente && t.cliente !== filtro.cliente) return false
    return true
  })
}

export function calcularPeriodo(insumos: InsumosPeriodo): ResultadoOrquestacion {
  const {
    periodoId, periodo, sociedadId, monedaSociedad, transacciones, splitsPorTransaccion,
    nodos, plantillas, componentes, asignaciones, metas, campanas, tiposCambio, conceptos, generarId,
  } = insumos

  const transaccionesPorId = new Map(transacciones.map((t) => [t.id_transaccion, t]))
  const conceptosPorCodigo = new Map(conceptos.map((c) => [c.codigo, c]))

  const creditos = transacciones.flatMap((t) =>
    atribuirCreditos(t, splitsPorTransaccion[t.id_transaccion] ?? [], nodos, generarId)
  )

  const resultados: ResultadoOrquestacion['resultados'] = []
  const errores: ResultadoOrquestacion['errores'] = []

  const push = (r: Omit<ResultadoCalculo, 'id_resultado' | 'periodo_id' | 'estado'>) =>
    resultados.push({ ...r, id_resultado: generarId(), periodo_id: periodoId, estado: 'preliminar' })

  for (const asignacion of asignaciones) {
    const plantilla = plantillas.find((p) => p.id === asignacion.plantilla_id)
    if (!plantilla || (plantilla.estado !== 'aprobado' && plantilla.estado !== 'vigente')) continue
    if (asignacion.vigencia_desde > finDeMes(periodo) || (asignacion.vigencia_hasta && asignacion.vigencia_hasta < `${periodo}-01`)) continue

    const componentesDePlantilla = componentes
      .filter((c) => c.plantilla_id === plantilla.id)
      .sort((a, b) => a.orden_evaluacion - b.orden_evaluacion)

    const creditosDestino = (
      asignacion.destino_tipo === 'comisionado'
        ? creditos.filter((c) => c.comisionado_id === asignacion.destino_id)
        : creditos.filter((c) => c.nodo_id === asignacion.destino_id)
    ).filter((c) => c.fecha_credito.slice(0, 7) === periodo)

    for (const componente of componentesDePlantilla) {
      const concepto = conceptosPorCodigo.get(componente.concepto_codigo)
      if (!concepto) {
        errores.push({ destino_id: asignacion.destino_id, componente_id: componente.id, mensaje: `concepto ${componente.concepto_codigo} no encontrado` })
        continue
      }

      try {
        if (componente.tipo === 'pool_equipo') {
          const integrantesIds = Array.from(new Set(creditosDestino.map((c) => c.comisionado_id)))
          const montoTotal = creditosDestino.reduce((acc, c) => acc + c.monto_atribuido, 0) * (componente.parametros.tasa ?? 1)
          const reparto = calcularPoolEquipo(
            montoTotal,
            componente.regla_reparto ?? 'partes_iguales',
            integrantesIds.map((id) => ({
              comisionado_id: id,
              aporte: creditosDestino.filter((c) => c.comisionado_id === id).reduce((acc, c) => acc + c.monto_atribuido, 0),
            }))
          )
          for (const [comisionadoId, importe] of Object.entries(reparto)) {
            const creditosIndividuo = creditosDestino.filter((c) => c.comisionado_id === comisionadoId)
            push({
              comisionado_id: comisionadoId,
              sociedad_id: sociedadId,
              concepto_codigo: concepto.codigo,
              plantilla_id: plantilla.id,
              componente_id: componente.id,
              importe: convertir(importe, plantilla.moneda, monedaSociedad, periodo, tiposCambio),
              moneda: monedaSociedad,
              detalle_diario: concepto.devengo_diario ? prorratearPorCreditos(importe, creditosIndividuo) : undefined,
              snapshot: {
                version_plantilla: plantilla.version,
                version_asignacion: asignacion.id,
                creditos: creditosIndividuo.map((c) => ({ id_credito: c.id_credito, monto: c.monto_atribuido })),
              },
            })
          }
          continue
        }

        if (componente.tipo === 'campaña') {
          if (asignacion.destino_tipo !== 'comisionado') continue // simplificación declarada
          const campanaAplicable = campanasAplicablesA(campanas, concepto.codigo, `${periodo}-15`)[0]
          const importe = campanaAplicable ? (campanaAplicable.monto ?? 0) : 0
          if (importe === 0) continue
          push({
            comisionado_id: asignacion.destino_id,
            sociedad_id: sociedadId,
            concepto_codigo: concepto.codigo,
            plantilla_id: plantilla.id,
            componente_id: componente.id,
            importe: convertir(importe, plantilla.moneda, monedaSociedad, periodo, tiposCambio),
            moneda: monedaSociedad,
            snapshot: { version_plantilla: plantilla.version, version_asignacion: asignacion.id, version_campana: campanaAplicable?.id_campana, creditos: [] },
          })
          continue
        }

        if (asignacion.destino_tipo === 'nodo') {
          // override_jerarquia también se asigna a un comisionado (el jefe que recibe el
          // override); solo pool_equipo (manejado arriba) tiene sentido con destino nodo.
          errores.push({
            destino_id: asignacion.destino_id,
            componente_id: componente.id,
            mensaje: `componente ${componente.tipo} asignado a un nodo — solo pool_equipo soporta destino de tipo nodo`,
          })
          continue
        }

        const elegibles = filtraElegibles(creditosDestino, transaccionesPorId, componente.filtro_elegibilidad)
        const valorBase = elegibles.reduce((acc, c) => acc + c.monto_atribuido, 0)

        let contexto: { pctLogro?: number; hitoCumplido?: boolean; valorBaseEquipo?: number } = {}
        if (componente.tipo === 'multiplicador_por_logro' || componente.tipo === 'monto_fijo_por_hito') {
          const meta = metaVigente(metas, asignacion.destino_tipo, asignacion.destino_id, periodo)
          if (!meta) {
            errores.push({ destino_id: asignacion.destino_id, componente_id: componente.id, mensaje: 'sin meta vigente para el período' })
            continue
          }
          contexto =
            componente.tipo === 'multiplicador_por_logro'
              ? { pctLogro: (valorBase / meta.magnitud) * 100 }
              : { hitoCumplido: valorBase >= meta.magnitud }
        }
        if (componente.tipo === 'override_jerarquia') {
          const nodoDelJefe = nodos.find((n) => n.titular === asignacion.destino_id)
          const nodosHijos = nodoDelJefe ? nodos.filter((n) => n.nodo_padre === nodoDelJefe.id_nodo) : []
          const idsHijos = new Set(nodosHijos.map((n) => n.id_nodo))
          contexto.valorBaseEquipo = creditos
            .filter((c) => c.nodo_id && idsHijos.has(c.nodo_id) && c.fecha_credito.slice(0, 7) === periodo)
            .reduce((acc, c) => acc + c.monto_atribuido, 0)
        }

        let importe = calcularComponente(componente, valorBase, contexto)

        const campanaAplicable = campanasAplicablesA(campanas, concepto.codigo, `${periodo}-15`)[0]
        if (campanaAplicable) importe = aplicarCampana(importe, campanaAplicable)

        importe = aplicarTope(importe, componente.tope_componente)

        push({
          comisionado_id: asignacion.destino_id,
          sociedad_id: sociedadId,
          concepto_codigo: concepto.codigo,
          plantilla_id: plantilla.id,
          componente_id: componente.id,
          importe: convertir(importe, plantilla.moneda, monedaSociedad, periodo, tiposCambio),
          moneda: monedaSociedad,
          detalle_diario: concepto.devengo_diario ? prorratearPorCreditos(importe, elegibles) : undefined,
          snapshot: {
            version_plantilla: plantilla.version,
            version_asignacion: asignacion.id,
            version_meta: metas.find((m) => m.destino_id === asignacion.destino_id)?.version,
            version_campana: campanaAplicable?.id_campana,
            creditos: elegibles.map((c) => ({ id_credito: c.id_credito, monto: c.monto_atribuido })),
          },
        })
      } catch (e) {
        errores.push({ destino_id: asignacion.destino_id, componente_id: componente.id, mensaje: e instanceof Error ? e.message : String(e) })
      }
    }
  }

  return { creditos, resultados: resultados.map((r) => ({ ...r, detalle_diario: r.detalle_diario as DetalleDiario[] | undefined })), errores }
}
