import type { Credito } from '../dominio/fase1/credito'
import type { ComponentePlan, Tramo, EscalonMultiplicador } from '../dominio/fase1/plan'
import type { DetalleDiario } from '../dominio/movimiento-devengo'

/**
 * §3.3 — cálculo por componente. Cada función recibe la base ya medida
 * (`valorBase`, según `componente.base_medicion`) y los parámetros propios
 * del componente (§2.6 no fija dónde viven tasa/tramos — ver ParametrosComponente).
 */

export function calcularTasaLineal(valorBase: number, tasa: number): number {
  return valorBase * tasa
}

/** escalonado_marginal — cada tramo aporta solo la parte de valorBase que cae dentro de él. */
export function calcularEscalonadoMarginal(valorBase: number, tramos: Tramo[]): number {
  let restante = valorBase
  let total = 0
  for (const t of [...tramos].sort((a, b) => a.desde - b.desde)) {
    if (restante <= 0) break
    const anchoTramo = t.hasta === null ? Infinity : t.hasta - t.desde
    const montoEnTramo = Math.min(restante, anchoTramo)
    total += montoEnTramo * t.tasa
    restante -= montoEnTramo
  }
  return total
}

/** escalonado_total — se identifica el tramo donde cae valorBase y su tasa se aplica al total. */
export function calcularEscalonadoTotal(valorBase: number, tramos: Tramo[]): number {
  const tramo = [...tramos]
    .sort((a, b) => a.desde - b.desde)
    .find((t) => valorBase >= t.desde && (t.hasta === null || valorBase < t.hasta))
  return tramo ? valorBase * tramo.tasa : 0
}

/** multiplicador_por_logro — el % de logro sobre meta determina el multiplicador aplicado a valorBase. */
export function calcularMultiplicadorPorLogro(valorBase: number, pctLogro: number, tabla: EscalonMultiplicador[]): number {
  const escalon = tabla.find((e) => pctLogro >= e.logro_pct_desde && (e.logro_pct_hasta === null || pctLogro < e.logro_pct_hasta))
  return escalon ? valorBase * escalon.multiplicador : 0
}

export function calcularMontoFijoPorHito(hitoCumplido: boolean, monto: number): number {
  return hitoCumplido ? monto : 0
}

/** override_jerarquia — el titular del nodo padre recibe una tasa sobre lo generado por el equipo a cargo. */
export function calcularOverrideJerarquia(valorBaseEquipo: number, tasaOverride: number): number {
  return valorBaseEquipo * tasaOverride
}

export interface IntegrantePool {
  comisionado_id: string
  aporte?: number // para ponderado_por_aporte
  dotacion?: number // para ponderado_por_dotacion
  monto_manual?: number // para manual_aprobado
}

/** pool_equipo — reparte un monto total entre los integrantes según regla_reparto. */
export function calcularPoolEquipo(
  montoTotal: number,
  regla: 'partes_iguales' | 'ponderado_por_aporte' | 'ponderado_por_dotacion' | 'manual_aprobado',
  integrantes: IntegrantePool[]
): Record<string, number> {
  const resultado: Record<string, number> = {}
  if (regla === 'partes_iguales') {
    const parte = montoTotal / integrantes.length
    for (const i of integrantes) resultado[i.comisionado_id] = parte
  } else if (regla === 'ponderado_por_aporte' || regla === 'ponderado_por_dotacion') {
    const clave = regla === 'ponderado_por_aporte' ? 'aporte' : 'dotacion'
    const totalPeso = integrantes.reduce((acc, i) => acc + (i[clave] ?? 0), 0)
    for (const i of integrantes) resultado[i.comisionado_id] = totalPeso > 0 ? (montoTotal * (i[clave] ?? 0)) / totalPeso : 0
  } else {
    // manual_aprobado — exige aprobación individual (§2.6); se asume ya aprobado al llegar aquí.
    for (const i of integrantes) resultado[i.comisionado_id] = i.monto_manual ?? 0
  }
  return resultado
}

export function aplicarTope(importe: number, tope?: number): number {
  return tope !== undefined ? Math.min(importe, tope) : importe
}

/**
 * Prorratea un importe total entre los días de sus créditos, proporcional al
 * monto_atribuido de cada crédito en ese día. No está prescrito por la
 * especificación (que solo exige la entrega diaria, §0.3, no un algoritmo de
 * asignación); es razonable para tasa_lineal (donde coincide exactamente con
 * el cálculo día a día) y una aproximación declarada para componentes no
 * lineales (escalonado, campañas) cuyo cálculo depende del acumulado del período.
 */
export function prorratearPorCreditos(importeTotal: number, creditos: Pick<Credito, 'fecha_credito' | 'monto_atribuido'>[]): DetalleDiario[] {
  const totalBase = creditos.reduce((acc, c) => acc + c.monto_atribuido, 0)
  if (totalBase === 0) return []

  const porDia = new Map<string, number>()
  for (const c of creditos) {
    porDia.set(c.fecha_credito, (porDia.get(c.fecha_credito) ?? 0) + c.monto_atribuido)
  }

  return Array.from(porDia.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([fecha, montoDia]) => ({ fecha, importe: (importeTotal * montoDia) / totalBase }))
}

export function calcularComponente(
  componente: ComponentePlan,
  valorBase: number,
  contexto: { pctLogro?: number; hitoCumplido?: boolean; valorBaseEquipo?: number } = {}
): number {
  const p = componente.parametros
  switch (componente.tipo) {
    case 'tasa_lineal':
      if (p.tasa === undefined) throw new Error(`componente ${componente.id}: tasa_lineal exige parametros.tasa`)
      return calcularTasaLineal(valorBase, p.tasa)
    case 'escalonado_marginal':
      if (!p.tramos) throw new Error(`componente ${componente.id}: escalonado_marginal exige parametros.tramos`)
      return calcularEscalonadoMarginal(valorBase, p.tramos)
    case 'escalonado_total':
      if (!p.tramos) throw new Error(`componente ${componente.id}: escalonado_total exige parametros.tramos`)
      return calcularEscalonadoTotal(valorBase, p.tramos)
    case 'multiplicador_por_logro':
      if (!p.tabla_multiplicador || contexto.pctLogro === undefined) {
        throw new Error(`componente ${componente.id}: multiplicador_por_logro exige parametros.tabla_multiplicador y pctLogro`)
      }
      return calcularMultiplicadorPorLogro(valorBase, contexto.pctLogro, p.tabla_multiplicador)
    case 'monto_fijo_por_hito':
      if (p.monto_hito === undefined) throw new Error(`componente ${componente.id}: monto_fijo_por_hito exige parametros.monto_hito`)
      return calcularMontoFijoPorHito(contexto.hitoCumplido ?? false, p.monto_hito)
    case 'override_jerarquia':
      if (p.tasa_override === undefined) throw new Error(`componente ${componente.id}: override_jerarquia exige parametros.tasa_override`)
      return calcularOverrideJerarquia(contexto.valorBaseEquipo ?? valorBase, p.tasa_override)
    case 'pool_equipo':
      throw new Error(`componente ${componente.id}: pool_equipo se calcula con calcularPoolEquipo(), no con calcularComponente()`)
    case 'campaña':
      // Una campaña no es un cálculo propio: multiplica/incrementa el resultado
      // de otro componente ya calculado (ver motor/campana.ts).
      return valorBase
  }
}
