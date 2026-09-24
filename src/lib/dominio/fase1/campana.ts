/** Campaña — §2.8. Resuelve el "2x porque faltan dos días". */
export interface Campana {
  id_campana: string
  sociedad_id: string
  concepto_codigo: string
  condicion: {
    tipo: 'meta_individual' | 'meta_grupal' | 'producto_focalizado' | 'mixta'
    detalle?: Record<string, unknown>
  }
  multiplicador?: number
  monto?: number
  vigencia_hecho_desde: string
  vigencia_hecho_hasta: string
  fecha_publicacion?: string
  /** Enum cerrado — regla dura #1 de §2.8, no texto libre. */
  alcance_retroactivo: 'desde_publicacion' | 'todo_el_periodo_abierto'
  presupuesto_estimado?: number
  presupuesto_tope: number
  autorizador?: string
  nivel_autorizacion?: string
  autorizado_en?: string
  estado: 'borrador' | 'autorizada' | 'publicada' | 'cerrada' | 'anulada'
}

/**
 * Las cuatro reglas duras de §2.8. `inicioPeriodoAbierto` es la fecha de
 * apertura del período de la sociedad contra la que se valida la regla 2.
 */
export function validarCampana(c: Campana, inicioPeriodoAbierto: string, devengoProyectado?: number): string[] {
  const errores: string[] = []

  // Regla 2 — vigencia_hecho_desde nunca antes del inicio del período abierto.
  if (c.vigencia_hecho_desde < inicioPeriodoAbierto) {
    errores.push('vigencia_hecho_desde es anterior al inicio del período abierto — no existe campaña que alcance un período cerrado (§2.8)')
  }

  // Regla 1 (parcial) — el alcance retroactivo "todo_el_periodo_abierto" cambia
  // la base de semana corrida / beneficio derivado del mes completo: exige
  // que el impacto se haya mostrado antes de autorizar (autorizador presente).
  if (c.alcance_retroactivo === 'todo_el_periodo_abierto' && c.estado !== 'borrador' && !c.autorizador) {
    errores.push('alcance_retroactivo = todo_el_periodo_abierto exige autorización explícita antes de publicar (§2.8)')
  }

  // Regla 3 — no autorizada no se publica; no publicada no calcula.
  if (c.estado === 'publicada' && (!c.autorizador || !c.autorizado_en)) {
    errores.push('campaña publicada sin autorización registrada — bloquea el cierre (§4.2)')
  }
  if ((c.estado === 'autorizada' || c.estado === 'publicada') && (!c.autorizador || !c.nivel_autorizacion || !c.autorizado_en)) {
    errores.push('campaña autorizada/publicada sin autorizador, nivel_autorizacion o autorizado_en completos (§2.8)')
  }

  // Regla 4 — presupuesto_tope contra el devengo proyectado.
  if (devengoProyectado !== undefined && devengoProyectado > c.presupuesto_tope && c.estado === 'publicada') {
    errores.push(`devengo proyectado (${devengoProyectado}) excede presupuesto_tope (${c.presupuesto_tope}) sin autorización de nivel superior (§2.8, §4.2)`)
  }

  if (!c.multiplicador && !c.monto) {
    errores.push('campaña sin multiplicador ni monto')
  }

  return errores
}

export function campanaCalcula(c: Campana): boolean {
  return c.estado === 'publicada'
}
