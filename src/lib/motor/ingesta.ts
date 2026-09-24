import type { Fuente, Transaccion, TransaccionSplit, RegistroCuarentena } from '../dominio/fase1/transaccion'
import { validarIngesta } from '../dominio/fase1/transaccion'

export type ResultadoIngesta =
  | { tipo: 'aceptada' }
  | { tipo: 'cuarentena'; registro: RegistroCuarentena }
  | { tipo: 'duplicado_rechazado' }
  | { tipo: 'duplicado_actualiza' }
  | { tipo: 'duplicado_versiona' }

/**
 * §3.1 — decide qué hacer con un registro entrante. No accede a la base de
 * datos: `existeDuplicado` es una consulta ya resuelta por el llamador
 * (típicamente contra la unique (fuente_id, clave_natural) de `transacciones`).
 * Nada se descarta silenciosamente: todo lo que no es "aceptada" queda con
 * motivo y es reprocesable (§3.1).
 */
export function procesarIngesta(params: {
  transaccion: Omit<Transaccion, 'id_transaccion'>
  splits: TransaccionSplit[]
  fuente: Fuente
  existeDuplicado: boolean
  comisionadoVigente: (comisionadoId: string, fecha: string) => boolean
  monedaConocida: (moneda: string) => boolean
  hoy: string
}): ResultadoIngesta {
  const { transaccion, splits, fuente, existeDuplicado, comisionadoVigente, monedaConocida, hoy } = params

  if (existeDuplicado) {
    if (fuente.politica_duplicados === 'rechazar') return { tipo: 'duplicado_rechazado' }
    if (fuente.politica_duplicados === 'actualizar') return { tipo: 'duplicado_actualiza' }
    return { tipo: 'duplicado_versiona' }
  }

  const motivos = validarIngesta({ transaccion, splits, fuente, comisionadoVigente, monedaConocida, hoy })
  if (motivos.length > 0) {
    return {
      tipo: 'cuarentena',
      registro: { fuente_id: fuente.id_fuente, payload: { transaccion, splits }, motivo: motivos.join('; ') },
    }
  }

  return { tipo: 'aceptada' }
}
