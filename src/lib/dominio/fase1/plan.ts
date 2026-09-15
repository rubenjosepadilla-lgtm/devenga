import type { CodigoPais } from '../tipos'

/**
 * Plan — §2.6. Modelo de cuatro niveles. Duplicar un plan para cambiar un
 * parámetro está prohibido por diseño: los ajustes individuales viven en
 * Override, no en una copia de la Plantilla.
 */

export type EstadoPlan = 'borrador' | 'aprobado' | 'vigente' | 'cerrado'

export interface PlantillaPlan {
  id: string
  /** No está en el texto literal de §2.6 (que solo lista `pais`); se agrega
   *  porque la aprobación (puerta 1, §4.1) y el costo proyectado son por
   *  sociedad. */
  sociedad_id: string
  nombre: string
  pais: CodigoPais
  periodicidad: 'diaria' | 'semanal' | 'mensual' | 'trimestral'
  moneda: string
  vigencia_desde: string
  vigencia_hasta?: string
  estado: EstadoPlan
  version: number
  aprobado_por?: string
  aprobado_en?: string
  simulacion_adjunta?: unknown
}

export type TipoComponente =
  | 'tasa_lineal'
  | 'escalonado_marginal'
  | 'escalonado_total'
  | 'multiplicador_por_logro'
  | 'monto_fijo_por_hito'
  | 'override_jerarquia'
  | 'pool_equipo'
  | 'campaña'

export type ReglaReparto = 'partes_iguales' | 'ponderado_por_aporte' | 'ponderado_por_dotacion' | 'manual_aprobado'

export interface ComponentePlan {
  id: string
  plantilla_id: string
  tipo: TipoComponente
  concepto_codigo: string
  base_medicion: 'unidades' | 'monto' | 'margen' | 'mix'
  filtro_elegibilidad?: Record<string, unknown>
  /** Superficie de configuración numérica (tasa, tramos, tabla, monto de hito). Ver ParametrosComponente. */
  parametros: ParametrosComponente
  tope_componente?: number
  orden_evaluacion: number
  /** Obligatorio si tipo = 'pool_equipo'. Sin default (§2.6). */
  regla_reparto?: ReglaReparto
}

export interface Tramo {
  desde: number
  hasta: number | null
  tasa: number
}

export interface EscalonMultiplicador {
  logro_pct_desde: number
  logro_pct_hasta: number | null
  multiplicador: number
}

/**
 * Configuración numérica por tipo de componente. No está en el texto literal
 * de la especificación (§2.6 no define dónde vive la tasa o los tramos);
 * es la implementación concreta de esa superficie de configuración.
 */
export interface ParametrosComponente {
  tasa?: number // tasa_lineal
  tramos?: Tramo[] // escalonado_marginal | escalonado_total
  tabla_multiplicador?: EscalonMultiplicador[] // multiplicador_por_logro
  monto_hito?: number // monto_fijo_por_hito
  tasa_override?: number // override_jerarquia
}

export interface AsignacionPlan {
  id: string
  plantilla_id: string
  destino_tipo: 'comisionado' | 'nodo'
  destino_id: string
  vigencia_desde: string
  vigencia_hasta?: string
  prioridad: number
}

export interface OverridePlan {
  id: string
  asignacion_id: string
  parametro: string
  valor: unknown
  vigencia_desde: string
  vigencia_hasta?: string
  motivo: string
  aprobado_por: string
  aprobado_en: string
}

export function validarComponentePlan(c: ComponentePlan): string[] {
  const errores: string[] = []
  if (c.tipo === 'pool_equipo' && !c.regla_reparto) {
    errores.push('componente pool_equipo sin regla_reparto — es obligatoria y no tiene default (§2.6)')
  }
  if ((c.tipo === 'escalonado_marginal' || c.tipo === 'escalonado_total') && !c.tipo) {
    // El propio `tipo` ya resuelve marginal/total — no hay campo adicional que validar,
    // pero se deja explícito porque es "la primera fuente de disputa en cualquier motor
    // de comisiones" (§2.6).
  }
  return errores
}

export function validarOverridePlan(o: OverridePlan): string[] {
  const errores: string[] = []
  if (!o.motivo || o.motivo.trim().length < 20) {
    errores.push('override sin motivo suficiente (mínimo 20 caracteres) — bloquea el cierre (§4.2)')
  }
  if (!o.aprobado_por || !o.aprobado_en) {
    errores.push('override sin aprobador — bloquea el cierre (§4.2)')
  }
  return errores
}
