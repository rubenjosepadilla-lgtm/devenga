/** Crédito — §3.2. Unidad atómica sobre la que calcula el motor. */
export interface Credito {
  id_credito: string
  transaccion_id: string
  comisionado_id: string
  porcentaje_split: number
  monto_atribuido: number
  fecha_credito: string
  nodo_id?: string
  /** Guarda la versión de jerarquía usada, para que el crédito sea reproducible aunque la jerarquía cambie después. */
  snapshot_jerarquia: unknown
}
