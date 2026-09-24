import type { CodigoPais } from '../tipos'

/** Roles de sociedad — soporte de segregación de funciones (§4.4). */
export type RolSociedad =
  | 'admin'
  | 'dueño_comercial'
  | 'control_gestion'
  | 'jefatura_comercial'
  | 'disenador_planes'
  | 'carga_metas'
  | 'aprueba_metas'
  | 'autoriza_campanas'
  | 'resuelve_disputas'
  | 'nomina'
  | 'lectura'

/** Sociedad (empleador) — §2.2. */
export interface Sociedad {
  id_sociedad: string
  pais: CodigoPais
  identificador_fiscal: string
  nombre: string
  sistema_nomina: 'suel2' | 'sap' | 'otro' | 'excel'
  modo_integracion: 'api' | 'archivo' | 'manual'
  calendario_periodos: 'mensual' | 'quincenal' | 'semanal'
  dia_corte_comisiones: number
  responsable_aprobacion: string
  creado_por: string
}

export interface UsuarioRolSociedad {
  usuario_id: string
  sociedad_id: string
  rol: RolSociedad
}
