import type { DetalleDiario } from '../movimiento-devengo'

/** Resultado de cálculo (snapshot) — §3.3. Precede al movimiento de devengo. */
export interface SnapshotCalculo {
  version_plantilla: number
  version_asignacion: string
  version_override?: string
  version_meta?: number
  version_jerarquia?: string
  version_campana?: string
  tipo_cambio_usado?: { tasa: number; fuente: string; fecha: string }
  creditos: { id_credito: string; monto: number }[]
}

export interface ResultadoCalculo {
  id_resultado: string
  periodo_id: string
  comisionado_id: string
  sociedad_id: string
  concepto_codigo: string
  plantilla_id: string
  componente_id?: string
  importe: number
  moneda: string
  detalle_diario?: DetalleDiario[]
  snapshot: SnapshotCalculo
  estado: 'preliminar' | 'congelado'
  id_movimiento?: string
}
