import type { Campana } from '../dominio/fase1/campana'

/**
 * §3.5 (2) — simulación de campaña, la pantalla que evita autorizar un 2x/3x/5x
 * sin ver el costo. Recibe la base diaria YA CALCULADA (pre-campaña) del
 * concepto afectado — típicamente `detalle_diario` de los resultados de
 * cálculo del período — y proyecta el costo incremental bajo los dos valores
 * posibles de `alcance_retroactivo` (§2.8 regla 1).
 *
 * No recalcula la comisión desde cero: si no hay resultados de cálculo para
 * el concepto en el período, no hay base sobre la que proyectar y quien llama
 * a esta función debe decírselo al usuario en vez de mostrar un costo de 0
 * que se leería como "esta campaña no cuesta nada".
 */

export interface ImporteDiario {
  fecha: string
  importe: number
}

export interface SimulacionCampana {
  costoDesdePublicacion: number
  costoTodoPeriodoAbierto: number
  /** Cuánto más cuesta elegir "todo_el_periodo_abierto" en vez de "desde_publicacion". */
  diferencia: number
  diasConBase: number
}

type CampanaParaSimular = Pick<Campana, 'multiplicador' | 'monto' | 'vigencia_hecho_desde' | 'vigencia_hecho_hasta' | 'fecha_publicacion'>

function costoIncrementalEnVentana(baseDiaria: ImporteDiario[], desde: string, hasta: string, campana: CampanaParaSimular): { costo: number; dias: number } {
  const enVentana = baseDiaria.filter((d) => d.fecha >= desde && d.fecha <= hasta)
  const costo = enVentana.reduce((acc, d) => {
    const conCampana = campana.multiplicador !== undefined ? d.importe * campana.multiplicador : d.importe + (campana.monto ?? 0)
    return acc + (conCampana - d.importe)
  }, 0)
  return { costo, dias: enVentana.length }
}

export function simularCampana(baseDiaria: ImporteDiario[], campana: CampanaParaSimular): SimulacionCampana {
  const inicioDesdePublicacion =
    campana.fecha_publicacion && campana.fecha_publicacion > campana.vigencia_hecho_desde
      ? campana.fecha_publicacion
      : campana.vigencia_hecho_desde

  const desdePublicacion = costoIncrementalEnVentana(baseDiaria, inicioDesdePublicacion, campana.vigencia_hecho_hasta, campana)
  const todoPeriodo = costoIncrementalEnVentana(baseDiaria, campana.vigencia_hecho_desde, campana.vigencia_hecho_hasta, campana)

  return {
    costoDesdePublicacion: desdePublicacion.costo,
    costoTodoPeriodoAbierto: todoPeriodo.costo,
    diferencia: todoPeriodo.costo - desdePublicacion.costo,
    diasConBase: todoPeriodo.dias,
  }
}

/** El escenario que realmente se usará al calcular, según el alcance_retroactivo ya elegido en la campaña. */
export function costoProyectadoSegunAlcance(sim: SimulacionCampana, alcance: Campana['alcance_retroactivo']): number {
  return alcance === 'todo_el_periodo_abierto' ? sim.costoTodoPeriodoAbierto : sim.costoDesdePublicacion
}
