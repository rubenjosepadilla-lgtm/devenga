/**
 * Tipos comunes del dominio — Fase 0.
 * Ver docs/fase-0 para la fundamentación de cada campo.
 */

export type CodigoPais = 'CL' | 'PE' | 'CO' | 'MX' | 'AR'

export const PAISES_V1: CodigoPais[] = ['CL', 'PE', 'CO', 'MX', 'AR']

/** Etiqueta de confianza de la especificación: Seguro / Probable / Suposición. */
export type Confianza = 'seguro' | 'probable' | 'suposicion'

export interface Fundamento {
  confianza: Confianza
  texto: string
  fuente?: string
}
