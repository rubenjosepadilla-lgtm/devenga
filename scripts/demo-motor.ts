/**
 * Prueba de humo del motor de cálculo — corre en memoria, sin base de datos.
 * Ejecuta el pipeline completo: transacción → créditos → cálculo de
 * componente → prorrateo diario → movimiento de devengo, y lo valida.
 *
 * Uso: npm run demo
 */
import { CATALOGO_CONCEPTOS } from '../src/lib/dominio/conceptos'
import type { Transaccion, TransaccionSplit } from '../src/lib/dominio/fase1/transaccion'
import type { NodoJerarquia } from '../src/lib/dominio/fase1/jerarquia'
import type { ComponentePlan } from '../src/lib/dominio/fase1/plan'
import { atribuirCreditos } from '../src/lib/motor/atribucion'
import { calcularComponente, prorratearPorCreditos } from '../src/lib/motor/calculo'
import { construirMovimientoDevengo } from '../src/lib/motor/movimiento'

let contador = 0
const generarId = () => `demo-${++contador}`

function fallar(mensaje: string): never {
  console.error(`✗ ${mensaje}`)
  process.exit(1)
}

console.log('--- Motor de Comisiones — prueba de humo (Fase 1) ---\n')

// 1) Dos transacciones facturadas en Chile para el mismo comisionado, días distintos.
const sociedadId = 'soc-demo-cl'
const comisionadoId = 'com-demo-1'
const nodoId = 'nodo-demo-1'

const transacciones: Omit<Transaccion, 'id_transaccion'>[] = [
  {
    fuente_id: 'fuente-demo',
    sociedad_id: sociedadId,
    pais: 'CL',
    fecha_hecho: '2026-09-03',
    fecha_credito: '2026-09-03',
    tipo_evento: 'factura',
    monto_bruto: 1_000_000,
    moneda: 'CLP',
    estado: 'valida',
    hash_origen: 'hash-1',
    clave_natural: 'venta-1',
  },
  {
    fuente_id: 'fuente-demo',
    sociedad_id: sociedadId,
    pais: 'CL',
    fecha_hecho: '2026-09-10',
    fecha_credito: '2026-09-10',
    tipo_evento: 'factura',
    monto_bruto: 500_000,
    moneda: 'CLP',
    estado: 'valida',
    hash_origen: 'hash-2',
    clave_natural: 'venta-2',
  },
]

const nodos: NodoJerarquia[] = [
  {
    id_nodo: nodoId,
    sociedad_id: sociedadId,
    tipo: 'equipo',
    titular: comisionadoId,
    vigencia_desde: '2026-01-01',
    motivo_cambio: 'alta inicial del equipo comercial',
    aprobado_por: 'demo',
    aprobado_en: '2026-01-01T00:00:00Z',
    tratamiento_corte: 'congelado_a_fecha_credito',
  },
]

const creditos = transacciones.flatMap((t, idx) => {
  const splits: TransaccionSplit[] = [{ comisionado_id: comisionadoId, porcentaje: 100 }]
  return atribuirCreditos({ ...t, id_transaccion: `tx-${idx}` }, splits, nodos, generarId)
})

console.log(`1) Atribución: ${creditos.length} créditos generados.`)
creditos.forEach((c) => console.log(`   - ${c.fecha_credito}: $${c.monto_atribuido.toLocaleString('es-CL')}`))

if (creditos.length !== 2) fallar('se esperaban 2 créditos')

// 2) Cálculo — componente tasa_lineal 3% sobre unidad_vendida, concepto CL-COM-VENTA.
const componente: ComponentePlan = {
  id: 'comp-demo-1',
  plantilla_id: 'plantilla-demo-1',
  tipo: 'tasa_lineal',
  concepto_codigo: 'CL-COM-VENTA',
  base_medicion: 'monto',
  parametros: { tasa: 0.03 },
  orden_evaluacion: 1,
}

const totalCreditado = creditos.reduce((acc, c) => acc + c.monto_atribuido, 0)
const importeTotal = calcularComponente(componente, totalCreditado)
console.log(`\n2) Cálculo: base $${totalCreditado.toLocaleString('es-CL')} × 3% = $${importeTotal.toLocaleString('es-CL')}`)

if (Math.abs(importeTotal - 45_000) > 0.01) fallar(`importe esperado 45.000, obtenido ${importeTotal}`)

// 3) Prorrateo diario — CL-COM-VENTA es devengo_diario = true, exige desagregación.
const detalleDiario = prorratearPorCreditos(importeTotal, creditos)
console.log(`\n3) Detalle diario (§0.3):`)
detalleDiario.forEach((d) => console.log(`   - ${d.fecha}: $${d.importe.toLocaleString('es-CL')}`))

const sumaDetalle = detalleDiario.reduce((acc, d) => acc + d.importe, 0)
if (Math.abs(sumaDetalle - importeTotal) > 0.01) fallar('el detalle diario no suma el importe total')

// 4) Movimiento de devengo.
const concepto = CATALOGO_CONCEPTOS.find((c) => c.codigo === 'CL-COM-VENTA')
if (!concepto) fallar('concepto CL-COM-VENTA no encontrado en el catálogo de Fase 0')

const { movimiento, errores } = construirMovimientoDevengo({
  resultado: {
    id_resultado: generarId(),
    periodo_id: 'periodo-demo-2026-09',
    comisionado_id: comisionadoId,
    sociedad_id: sociedadId,
    concepto_codigo: concepto.codigo,
    plantilla_id: componente.plantilla_id,
    componente_id: componente.id,
    importe: importeTotal,
    moneda: 'CLP',
    detalle_diario: detalleDiario,
    snapshot: { version_plantilla: 1, version_asignacion: 'asig-demo-1', creditos: creditos.map((c) => ({ id_credito: c.id_credito, monto: c.monto_atribuido })) },
    estado: 'congelado',
  },
  concepto,
  comisionadoId,
  sociedadId,
  periodoOrigen: '2026-09',
  periodoImputacion: '2026-09',
  urlDocumento: 'https://demo.local/documento/2026-09',
  generarId,
})

console.log(`\n4) Movimiento de devengo construido: ${movimiento.id_movimiento}`)
console.log(`   incide_en: ${movimiento.incide_en.join(', ')}`)
console.log(`   hash_detalle: ${movimiento.hash_detalle.slice(0, 16)}...`)

if (errores.length > 0) fallar(`movimiento inválido: ${errores.join('; ')}`)

console.log('\n✓ Pipeline completo sin errores de validación.')
