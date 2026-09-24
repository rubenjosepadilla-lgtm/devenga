import type { CodigoPais } from './tipos'
import { matrizLegalDe } from './matriz-legal'

/**
 * Concepto — §2.5 de la especificación. Es el objeto central del producto:
 * cada importe que sale del motor pertenece a un concepto, y el concepto
 * lleva su clasificación legal.
 *
 * No hay valor por defecto para `devengo_diario` ni `incide_en`: un concepto
 * sin ambos resueltos no puede usarse en un plan (ver validarConceptoUsable).
 */

export type Naturaleza = 'comision' | 'premio' | 'spif' | 'override' | 'bono_meta' | 'ajuste'
export type BaseDevengo = 'unidad_vendida' | 'meta_individual' | 'meta_grupal' | 'mixta'
export type EventoDevengo = 'firma' | 'despacho' | 'facturacion' | 'cobro' | 'otro'
export type GranularidadEntrega = 'diaria' | 'mensual'

export interface Caracter {
  principalidad: 'principal' | 'accesorio'
  ordinariedad: 'ordinario' | 'extraordinario'
}

export interface Concepto {
  codigo: string
  nombre: string
  pais: CodigoPais
  naturaleza: Naturaleza
  base_devengo: BaseDevengo
  evento_devengo: EventoDevengo
  /** Resuelto explícitamente, sin default. Fuerza granularidad_entrega = 'diaria'. */
  devengo_diario: boolean
  /** Obligatorio cuando devengo_diario está resuelto — es la justificación legal, no un comentario. */
  fundamento_devengo_diario: string
  caracter: Caracter
  remunerativo: boolean
  /** Beneficios derivados afectados — deben existir en la matriz legal del país. */
  incide_en: string[]
  granularidad_entrega: GranularidadEntrega
  reversible: boolean
  causales_reversion?: string[]
  mapeo_nomina?: string
  tope_concepto?: number
  vigencia_desde: string
  vigencia_hasta?: string
}

/**
 * Controles bloqueantes de §2.5 / §4.2 aplicados a un concepto antes de
 * permitir su uso en un plan. Devuelve la lista de motivos de bloqueo;
 * vacío = concepto usable.
 */
export function validarConceptoUsable(c: Concepto): string[] {
  const errores: string[] = []

  if (!c.fundamento_devengo_diario || c.fundamento_devengo_diario.trim().length < 20) {
    errores.push('fundamento_devengo_diario ausente o insuficiente (mínimo 20 caracteres) — devengo_diario no está "resuelto"')
  }

  if (!c.incide_en || c.incide_en.length === 0) {
    errores.push('incide_en[] vacío — la clasificación legal del concepto no está poblada')
  } else {
    const beneficiosValidos = new Set(matrizLegalDe(c.pais).incidencias.map((i) => i.beneficio))
    const desconocidos = c.incide_en.filter((b) => !beneficiosValidos.has(b))
    if (desconocidos.length > 0) {
      errores.push(`incide_en[] referencia beneficios no declarados en la matriz legal de ${c.pais}: ${desconocidos.join(', ')}`)
    }
  }

  if (c.devengo_diario && c.granularidad_entrega !== 'diaria') {
    errores.push('devengo_diario = true exige granularidad_entrega = "diaria" — no es parámetro opcional')
  }

  // §3.4 — Chile bloquea el evento de devengo "cobro"
  if (c.pais === 'CL' && c.evento_devengo === 'cobro') {
    errores.push('Chile: el evento_devengo "cobro" está bloqueado — la comisión se devenga al ejecutarse la prestación, no al cobro (§3.4)')
  }

  return errores
}

/** Catálogo semilla — representativo, no exhaustivo. Cada país necesita revisión con laboralista local (§9.1). */
export const CATALOGO_CONCEPTOS: Concepto[] = [
  {
    codigo: 'CL-COM-VENTA',
    nombre: 'Comisión por venta individual facturada',
    pais: 'CL',
    naturaleza: 'comision',
    base_devengo: 'unidad_vendida',
    evento_devengo: 'facturacion',
    devengo_diario: true,
    fundamento_devengo_diario:
      'Comisión individual sobre unidades facturadas, principal y ordinaria: cumple el criterio ' +
      'de la Dirección del Trabajo para integrar la base de semana corrida (§2.5, zona gris en §9.3 si se condiciona a meta).',
    caracter: { principalidad: 'principal', ordinariedad: 'ordinario' },
    remunerativo: true,
    incide_en: ['semana_corrida', 'gratificacion', 'feriado', 'indemnizaciones', 'base_imponible'],
    granularidad_entrega: 'diaria',
    reversible: true,
    causales_reversion: ['anulacion_por_incumplimiento_del_trabajador'],
    mapeo_nomina: 'HABER_COMISION_CL',
    vigencia_desde: '2026-01-01',
  },
  {
    codigo: 'CL-PREMIO-META-MENSUAL',
    nombre: 'Premio mensual por meta grupal de establecimiento',
    pais: 'CL',
    naturaleza: 'bono_meta',
    base_devengo: 'meta_grupal',
    evento_devengo: 'otro',
    devengo_diario: false,
    fundamento_devengo_diario:
      'Premio mensual repartido entre vendedores sobre venta neta del establecimiento: la DT niega ' +
      'expresamente semana corrida a este caso (§2.5); se devenga al cierre del mes, no día a día.',
    caracter: { principalidad: 'accesorio', ordinariedad: 'extraordinario' },
    remunerativo: true,
    incide_en: ['gratificacion', 'base_imponible'],
    granularidad_entrega: 'mensual',
    reversible: true,
    causales_reversion: ['meta_no_cumplida_tras_ajuste'],
    mapeo_nomina: 'HABER_PREMIO_META_CL',
    vigencia_desde: '2026-01-01',
  },
  {
    codigo: 'PE-COM-PRINCIPAL',
    nombre: 'Comisión como remuneración principal (comisionista puro)',
    pais: 'PE',
    naturaleza: 'comision',
    base_devengo: 'unidad_vendida',
    evento_devengo: 'facturacion',
    devengo_diario: true,
    fundamento_devengo_diario:
      'Remuneración principal del comisionista puro: promedia sobre el semestre sin requisito de ' +
      'regularidad, por lo que se registra devengo diario para permitir ese promedio exacto (§7 Perú).',
    caracter: { principalidad: 'principal', ordinariedad: 'ordinario' },
    remunerativo: true,
    incide_en: ['cts', 'gratificaciones', 'vacaciones', 'cts_al_cese'],
    granularidad_entrega: 'diaria',
    reversible: true,
    causales_reversion: ['nota_de_credito_del_origen'],
    mapeo_nomina: 'HABER_COMISION_PE',
    vigencia_desde: '2026-01-01',
  },
  {
    codigo: 'CO-COM-VENTA',
    nombre: 'Comisión sobre ventas (art. 127 CST)',
    pais: 'CO',
    naturaleza: 'comision',
    base_devengo: 'unidad_vendida',
    evento_devengo: 'facturacion',
    devengo_diario: true,
    fundamento_devengo_diario:
      'Calificada como salario por texto expreso del art. 127 CST; se liquida sobre promedio con ' +
      'salario variable, lo que exige desagregación diaria para calcular ese promedio (§7 Colombia).',
    caracter: { principalidad: 'principal', ordinariedad: 'ordinario' },
    remunerativo: true,
    incide_en: ['prima', 'cesantias', 'intereses_cesantias', 'vacaciones', 'ibc', 'indemnizacion'],
    granularidad_entrega: 'diaria',
    reversible: true,
    causales_reversion: ['nota_de_credito_del_origen'],
    mapeo_nomina: 'HABER_COMISION_CO',
    vigencia_desde: '2026-01-01',
  },
  {
    codigo: 'MX-COM-VENTA',
    nombre: 'Comisión sobre ventas (SBC variable)',
    pais: 'MX',
    naturaleza: 'comision',
    base_devengo: 'unidad_vendida',
    evento_devengo: 'facturacion',
    devengo_diario: true,
    fundamento_devengo_diario:
      'Integra el SBC promediando los ingresos de los dos meses inmediatos anteriores entre los ' +
      'días de salario devengado, con aviso bimestral al IMSS; requiere desagregación diaria (§7 México).',
    caracter: { principalidad: 'principal', ordinariedad: 'ordinario' },
    remunerativo: true,
    incide_en: ['sbc_imss', 'aguinaldo', 'prima_vacacional', 'indemnizacion'],
    granularidad_entrega: 'diaria',
    reversible: true,
    causales_reversion: ['nota_de_credito_del_origen'],
    mapeo_nomina: 'HABER_COMISION_MX',
    vigencia_desde: '2026-01-01',
  },
  {
    codigo: 'AR-COM-VENTA',
    nombre: 'Comisión sobre ventas',
    pais: 'AR',
    naturaleza: 'comision',
    base_devengo: 'unidad_vendida',
    evento_devengo: 'facturacion',
    devengo_diario: true,
    fundamento_devengo_diario:
      'Las comisiones no se promedian en Argentina: se suman al mes en que se devengaron y ese mes ' +
      'puede redefinir el SAC del semestre; se registra devengo diario para identificar el mes exacto (§7 Argentina).',
    caracter: { principalidad: 'principal', ordinariedad: 'ordinario' },
    remunerativo: true,
    incide_en: ['sac', 'vacaciones', 'indemnizacion'],
    granularidad_entrega: 'diaria',
    reversible: true,
    causales_reversion: ['nota_de_credito_del_origen'],
    mapeo_nomina: 'HABER_COMISION_AR',
    vigencia_desde: '2026-01-01',
  },
]
