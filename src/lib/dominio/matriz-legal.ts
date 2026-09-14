import type { CodigoPais, Confianza } from './tipos'

/**
 * Matriz legal por país — §7 de la especificación funcional.
 *
 * Esta tabla ES el producto: determina si un concepto entra a una base derivada
 * y con qué ventana. `incidencias` alimenta el campo `incide_en[]` de cada
 * Concepto (ver conceptos.ts) y bloquea su uso en un plan si no está resuelto
 * (ver aprobaciones.ts → CONTROLES_BLOQUEANTES).
 *
 * La ventana de promedio NO es un parámetro global: es (país × concepto × beneficio).
 * Ninguna de las cinco coincide con otra — no generalizar entre filas.
 */

export interface IncidenciaLegal {
  /** Beneficio derivado que la comisión puede afectar (semana corrida, CTS, SAC, etc.) */
  beneficio: string
  /** Cómo se computa la ventana/base de ese beneficio para comisiones */
  ventana_calculo: string
  confianza: Confianza
}

export interface MatrizLegalPais {
  pais: CodigoPais
  /** Regla general de devengo y calificación legal de la comisión en este país */
  regla_comision: string
  incidencias: IncidenciaLegal[]
  confianza_calificacion: Confianza
  /** Riesgo declarado asociado (referencia a §9) */
  riesgo_declarado?: string
}

export const MATRIZ_LEGAL: MatrizLegalPais[] = [
  {
    pais: 'CL',
    regla_comision:
      'Se devenga en el período de la operación y se liquida con las remuneraciones de ese ' +
      'período, con independencia de la condición de pago pactada con el cliente. La Dirección ' +
      'del Trabajo exige que la remuneración variable sea devengada diariamente, principal y ' +
      'ordinaria para entrar a la base de semana corrida; niega el beneficio a comisiones ' +
      'mensuales sobre venta neta del establecimiento repartidas entre vendedores. Anexo ' +
      'obligatorio con detalle por operación y método de cálculo.',
    incidencias: [
      { beneficio: 'semana_corrida', ventana_calculo: 'diaria — solo si devengo_diario = true, principal y ordinaria', confianza: 'seguro' },
      { beneficio: 'gratificacion', ventana_calculo: 'anual sobre remuneración devengada', confianza: 'probable' },
      { beneficio: 'feriado', ventana_calculo: 'promedio últimos 3 meses de variable', confianza: 'probable' },
      { beneficio: 'indemnizaciones', ventana_calculo: 'promedio últimos 3 meses o últimos 12 según concepto', confianza: 'probable' },
      { beneficio: 'base_imponible', ventana_calculo: 'mensual, tope imponible vigente', confianza: 'seguro' },
    ],
    confianza_calificacion: 'seguro',
    riesgo_declarado:
      'Zona gris: si un premio condicionado a meta mensual se entiende devengado diariamente ' +
      'al cumplirse la condición. Requiere opinión firmada; el motor obliga a declarar postura (§9.3).',
  },
  {
    pais: 'PE',
    regla_comision:
      'Doble régimen. Comisión complementaria: entra a CTS y gratificaciones solo si se percibió ' +
      'al menos 3 meses en el semestre, sumando y dividiendo entre 6. Comisión como remuneración ' +
      'principal (comisionista puro): promedio del semestre sin requisito de regularidad.',
    incidencias: [
      { beneficio: 'cts', ventana_calculo: 'complementaria: suma semestre / 6, si ≥3 meses percibidos; principal: promedio semestral sin requisito', confianza: 'seguro' },
      { beneficio: 'gratificaciones', ventana_calculo: 'igual regla que CTS según tipo de comisión', confianza: 'seguro' },
      { beneficio: 'vacaciones', ventana_calculo: 'promedio semestral', confianza: 'seguro' },
      { beneficio: 'cts_al_cese', ventana_calculo: 'proporcional al semestre en curso', confianza: 'seguro' },
    ],
    confianza_calificacion: 'seguro',
    riesgo_declarado: 'Sin opinión legal firmada en el foro local (§9.1) — matriz apoyada en fuentes secundarias.',
  },
  {
    pais: 'CO',
    regla_comision:
      'Los porcentajes sobre ventas y comisiones son salario por texto expreso del art. 127 CST. ' +
      'Base de prestaciones sociales, cesantías, prima e IBC. Con salario variable se liquida sobre promedio.',
    incidencias: [
      { beneficio: 'prima', ventana_calculo: 'promedio del semestre (ventana exacta pendiente de opinión local)', confianza: 'probable' },
      { beneficio: 'cesantias', ventana_calculo: 'promedio anual devengado', confianza: 'probable' },
      { beneficio: 'intereses_cesantias', ventana_calculo: 'sobre saldo de cesantías del año', confianza: 'probable' },
      { beneficio: 'vacaciones', ventana_calculo: 'promedio del año o de los últimos 3 meses si es más favorable', confianza: 'probable' },
      { beneficio: 'ibc', ventana_calculo: 'mensual, según ingreso variable devengado', confianza: 'seguro' },
      { beneficio: 'indemnizacion', ventana_calculo: 'promedio último año', confianza: 'probable' },
    ],
    confianza_calificacion: 'seguro',
    riesgo_declarado: 'Sin opinión legal firmada en el foro local (§9.1) — ventanas de promedio en [Probable].',
  },
  {
    pais: 'MX',
    regla_comision:
      'El componente variable se integra al SBC promediando los ingresos de los dos meses ' +
      'inmediatos anteriores divididos por los días de salario devengado, con aviso bimestral al ' +
      'IMSS. Para salario variable, base de cálculo = promedio de los 30 días anteriores al ' +
      'nacimiento del derecho.',
    incidencias: [
      { beneficio: 'sbc_imss', ventana_calculo: 'bimestral — promedio 2 meses anteriores / días de salario devengado, con aviso IMSS', confianza: 'seguro' },
      { beneficio: 'aguinaldo', ventana_calculo: 'promedio de los 30 días anteriores al nacimiento del derecho', confianza: 'seguro' },
      { beneficio: 'prima_vacacional', ventana_calculo: 'misma base que aguinaldo', confianza: 'seguro' },
      { beneficio: 'indemnizacion', ventana_calculo: 'promedio de los 30 días anteriores', confianza: 'seguro' },
    ],
    confianza_calificacion: 'seguro',
    riesgo_declarado: 'Sin opinión legal firmada en el foro local (§9.1) — matriz apoyada en fuentes secundarias.',
  },
  {
    pais: 'AR',
    regla_comision:
      'SAC = 50% de la mayor remuneración mensual devengada del semestre. Las comisiones no se ' +
      'promedian: se suman al mes en que se devengaron. Un mes con un multiplicador alto (p. ej. 5x) ' +
      'redefine el aguinaldo del semestre completo.',
    incidencias: [
      { beneficio: 'sac', ventana_calculo: 'no promedia — 50% de la mayor remuneración mensual devengada del semestre', confianza: 'seguro' },
      { beneficio: 'vacaciones', ventana_calculo: 'sobre la mejor remuneración del semestre', confianza: 'seguro' },
      { beneficio: 'indemnizacion', ventana_calculo: 'mejor remuneración mensual, normal y habitual, del último año', confianza: 'seguro' },
    ],
    confianza_calificacion: 'seguro',
    riesgo_declarado:
      'Blanco móvil: referencias no verificadas a una reforma laboral 2026 que tocaría bases de ' +
      'cálculo (§9.2) — verificar antes de comprometer Argentina en v1.',
  },
]

export function matrizLegalDe(pais: CodigoPais): MatrizLegalPais {
  const fila = MATRIZ_LEGAL.find((m) => m.pais === pais)
  if (!fila) throw new Error(`Sin matriz legal cargada para ${pais}`)
  return fila
}
