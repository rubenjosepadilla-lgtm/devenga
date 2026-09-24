/**
 * Política de aprobaciones — §4 de la especificación.
 * Las seis puertas (§4.1), los controles bloqueantes de cierre (§4.2)
 * y la segregación de funciones (§4.4).
 */

export interface Puerta {
  numero: number
  nombre: string
  que_se_confirma: string
  quien: string
  que_queda: string
}

export const PUERTAS_APROBACION: Puerta[] = [
  {
    numero: 1,
    nombre: 'Aprobación de plantilla',
    que_se_confirma: 'Estructura y costo proyectado',
    quien: 'Dueño comercial + control de gestión',
    que_queda: 'Versión firmada, simulación adjunta',
  },
  {
    numero: 2,
    nombre: 'Aprobación de meta',
    que_se_confirma: 'Magnitud y destino',
    quien: 'Jefatura según workflow de la sociedad',
    que_queda: 'Versión de meta con motivo',
  },
  {
    numero: 3,
    nombre: 'Autorización de campaña',
    que_se_confirma: 'Multiplicador, alcance retroactivo, presupuesto',
    quien: 'Nivel según monto proyectado',
    que_queda: 'Autorización previa a publicación',
  },
  {
    numero: 4,
    nombre: 'Congelamiento de cálculo',
    que_se_confirma: 'Nada cambia desde aquí',
    quien: 'Automático al corte',
    que_queda: 'Snapshot + hash',
  },
  {
    numero: 5,
    nombre: 'Aprobación de liquidación',
    que_se_confirma: 'Importes a enviar a nómina',
    quien: 'Jefatura comercial + control',
    que_queda: 'Acta con totales y excepciones',
  },
  {
    numero: 6,
    nombre: 'Acuse de pago',
    que_se_confirma: 'Lo enviado fue pagado',
    quien: 'Nómina',
    que_queda: 'Conciliación cerrada',
  },
]

/** El documento del comisionado es definitivo solo tras esta puerta (§4.1). */
export const PUERTA_DEFINITIVA = 6

/**
 * Controles bloqueantes de cierre de período — §4.2.
 * No es posible cerrar un período si existe alguno de estos.
 */
export const CONTROLES_BLOQUEANTES: string[] = [
  'Transacción en cuarentena sin resolver',
  'Split que no suma 100%',
  'Comisionado sin vínculo laboral vigente a la fecha_devengo',
  'Concepto sin devengo_diario resuelto o sin incide_en[] para el país',
  'Campaña publicada sin autorización registrada',
  'Override sin motivo o sin aprobador',
  'Meta en estado borrador con resultados calculados contra ella',
  'Tipo de cambio faltante para alguna moneda del período',
  'Diferencia entre el total calculado y el total de movimientos generados',
  'Monto que excede presupuesto_tope de campaña sin autorización superior',
]

/** Segregación de funciones — §4.4. Roles que nunca pueden coincidir en la misma persona. */
export interface ReglaSegregacion {
  rol_a: string
  rol_b: string
  motivo: string
}

export const SEGREGACION_DE_FUNCIONES: ReglaSegregacion[] = [
  { rol_a: 'carga_metas', rol_b: 'aprueba_metas', motivo: 'Quien carga metas no aprueba metas' },
  { rol_a: 'diseña_planes', rol_b: 'aprueba_liquidaciones', motivo: 'Quien diseña planes no aprueba liquidaciones' },
  { rol_a: 'resuelve_disputas', rol_b: 'aprueba_ajustes_propios', motivo: 'Quien resuelve disputas no aprueba ajustes propios' },
]

/** true si el mismo actor ocupando ambos roles de una regla viola la segregación. */
export function violaSegregacion(actor: string, rolesDelActor: Set<string>): ReglaSegregacion[] {
  return SEGREGACION_DE_FUNCIONES.filter(
    (r) => rolesDelActor.has(r.rol_a) && rolesDelActor.has(r.rol_b)
  )
}
