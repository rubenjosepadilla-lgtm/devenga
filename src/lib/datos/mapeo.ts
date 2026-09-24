import type { Concepto } from '../dominio/conceptos'
import type { MovimientoDevengo } from '../dominio/movimiento-devengo'

/**
 * Adaptadores entre la forma de dominio (con objetos anidados, más cómoda
 * para las funciones puras del motor) y la forma de fila de Postgres (columnas
 * planas). `Concepto.caracter` y `MovimientoDevengo.caracter` son un objeto
 * `{ principalidad, ordinariedad }` en TypeScript, pero `conceptos` y
 * `movimientos_devengo` los guardan como dos columnas de texto separadas —
 * ni `schema.sql` tiene una columna `caracter`. Sin este adaptador:
 * - Al leer: `fila.caracter` es `undefined` (la fila no trae esa clave).
 * - Al escribir: un insert masivo arma su lista de columnas con
 *   `Object.keys()` del objeto — que SÍ incluye `caracter` aunque su valor
 *   sea `undefined` (a diferencia de `JSON.stringify`, que la habría
 *   descartado) — y Postgres responde "no existe la columna caracter".
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function filaAConcepto(fila: any): Concepto {
  return {
    ...fila,
    caracter: { principalidad: fila.principalidad, ordinariedad: fila.ordinariedad },
  }
}

export function movimientoParaFila(m: MovimientoDevengo) {
  const { caracter, ...resto } = m
  return {
    ...resto,
    principalidad: caracter.principalidad,
    ordinariedad: caracter.ordinariedad,
  }
}
