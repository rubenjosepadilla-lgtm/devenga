/**
 * Estados del portal — §5: `estimado provisional` → `calculado` → `aprobado`
 * → `enviado a nómina` → `pagado`.
 *
 * Simplificación heredada de Fase 1 (ver docs/fase-1/00-resumen.md, punto 3):
 * el cierre de período congela los resultados, genera los movimientos de
 * devengo Y marca el período cerrado en una sola operación (las puertas 4 y
 * 5 están colapsadas). Eso significa que, con la implementación actual,
 * `calculado` y `aprobado` no son observables como pasos separados — ocurren
 * en el mismo instante que `enviado a nómina`. El portal muestra los tres
 * estados que sí son reales hoy; separar `calculado`/`aprobado` requiere
 * primero separar esas dos puertas en el motor (trabajo de una fase futura).
 */
export type EstadoPortal = 'estimado_provisional' | 'enviado_a_nomina' | 'pagado'

export const ETIQUETA_ESTADO_PORTAL: Record<EstadoPortal, string> = {
  estimado_provisional: 'Estimado provisional',
  enviado_a_nomina: 'Enviado a nómina',
  pagado: 'Pagado',
}

export function estadoPortalDe(
  resultado: { estado: 'preliminar' | 'congelado' },
  movimiento: { estado: 'enviado' | 'acusado' | 'pagado' | 'rechazado' } | null | undefined
): EstadoPortal {
  if (!movimiento) return 'estimado_provisional'
  if (movimiento.estado === 'pagado') return 'pagado'
  return 'enviado_a_nomina'
}
