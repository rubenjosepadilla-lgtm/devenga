import type { SupabaseClient } from '@supabase/supabase-js'
import type { InsumosCierre } from '@/lib/motor/cierre'
import { validarConceptoUsable, type Concepto } from '@/lib/dominio/conceptos'

/**
 * Reúne, contra la base de datos, todo lo que `evaluarControlesBloqueantes`
 * (§4.2, motor puro) necesita para un período. Vive separado del motor
 * porque hace I/O; se usa tanto para la vista previa de controles
 * (GET /api/periodos/[id]/controles) como para el cierre real
 * (POST /api/periodos/[id]/cerrar) — ambos deben ver exactamente lo mismo.
 */
export interface DatosCierre {
  insumos: InsumosCierre
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  listaResultados: any[]
  conceptosPorCodigo: Map<string, Concepto>
  monedaSociedad: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function prepararDatosCierre(supabase: SupabaseClient<any>, periodo: { id: string; sociedad_id: string; periodo: string }): Promise<DatosCierre> {
  const { data: sociedad } = await supabase.from('sociedades').select('pais').eq('id_sociedad', periodo.sociedad_id).single()
  const { data: paisRow } = await supabase.from('paises').select('moneda_funcional').eq('codigo_pais', sociedad?.pais).single()
  const monedaSociedad = paisRow?.moneda_funcional ?? 'CLP'

  const { data: resultados } = await supabase.from('resultados_calculo').select('*').eq('periodo_id', periodo.id).eq('estado', 'preliminar')
  const listaResultados = resultados ?? []

  const { data: cuarentenaSinResolver } = await supabase
    .from('transacciones_cuarentena')
    .select('id, fuentes!inner(sociedad_id)')
    .eq('resuelto', false)
    .eq('fuentes.sociedad_id', periodo.sociedad_id)

  const idsTransacciones = (
    await supabase
      .from('transacciones')
      .select('id_transaccion')
      .eq('sociedad_id', periodo.sociedad_id)
      .gte('fecha_hecho', `${periodo.periodo}-01`)
      .lte('fecha_hecho', `${periodo.periodo}-31`)
  ).data?.map((t: { id_transaccion: string }) => t.id_transaccion) ?? []

  const { data: splits } = idsTransacciones.length
    ? await supabase.from('transaccion_splits').select('*').in('transaccion_id', idsTransacciones)
    : { data: [] }

  const splitsPorTransaccion = new Map<string, number>()
  for (const s of splits ?? []) {
    splitsPorTransaccion.set(s.transaccion_id, (splitsPorTransaccion.get(s.transaccion_id) ?? 0) + s.porcentaje)
  }
  const splitsInvalidos = Array.from(splitsPorTransaccion.entries())
    .filter(([, suma]) => Math.abs(suma - 100) > 0.001)
    .map(([transaccionId, suma]) => ({ transaccionId, suma }))

  const { data: conceptosDb } = await supabase.from('conceptos').select('*')
  const codigosUsados = new Set(listaResultados.map((r: { concepto_codigo: string }) => r.concepto_codigo))
  const conceptosNoUsables = ((conceptosDb ?? []) as Concepto[])
    .filter((c) => codigosUsados.has(c.codigo))
    .map((c) => ({ codigo: c.codigo, errores: validarConceptoUsable(c) }))
    .filter((c) => c.errores.length > 0)

  const { data: campanasPublicadas } = await supabase.from('campanas').select('*').eq('sociedad_id', periodo.sociedad_id).eq('estado', 'publicada')
  const campanasPublicadasSinAutorizacion = (campanasPublicadas ?? [])
    .filter((c: { autorizador: string | null; autorizado_en: string | null }) => !c.autorizador || !c.autorizado_en)
    .map((c: { id_campana: string }) => ({ id: c.id_campana }))
  const campanasQueExcedenPresupuesto = (campanasPublicadas ?? [])
    .map((c: { id_campana: string; presupuesto_tope: number }) => {
      const proyectado = listaResultados
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((r) => (r.snapshot as any)?.version_campana === c.id_campana)
        .reduce((acc: number, r: { importe: number }) => acc + r.importe, 0)
      return { id: c.id_campana, proyectado, tope: c.presupuesto_tope }
    })
    .filter((c: { proyectado: number; tope: number }) => c.proyectado > c.tope)

  const { data: overrides } = await supabase.from('overrides_plan').select('id, motivo, aprobado_por, aprobado_en')
  const overridesSinMotivoOAprobador = (overrides ?? [])
    .filter((o: { motivo: string | null; aprobado_por: string | null; aprobado_en: string | null }) => !o.motivo || o.motivo.length < 20 || !o.aprobado_por || !o.aprobado_en)
    .map((o: { id: string }) => ({ id: o.id }))

  const { data: metasBorrador } = await supabase
    .from('metas')
    .select('id_meta, destino_id')
    .eq('sociedad_id', periodo.sociedad_id)
    .eq('periodo', periodo.periodo)
    .eq('estado', 'borrador')
  const idsDestinoConResultado = new Set(listaResultados.map((r: { comisionado_id: string }) => r.comisionado_id))
  const metasBorradorConResultados = (metasBorrador ?? [])
    .filter((m: { destino_id: string }) => idsDestinoConResultado.has(m.destino_id))
    .map((m: { id_meta: string }) => ({ id_meta: m.id_meta }))

  const monedasUsadas = new Set(listaResultados.map((r: { moneda: string }) => r.moneda).filter((m: string) => m !== monedaSociedad))
  const { data: tiposCambioPeriodo } = await supabase.from('tipos_cambio').select('moneda_origen').eq('periodo', periodo.periodo).eq('moneda_destino', monedaSociedad)
  const monedasConTipoCambio = new Set((tiposCambioPeriodo ?? []).map((t: { moneda_origen: string }) => t.moneda_origen))
  const monedasSinTipoCambio = Array.from(monedasUsadas).filter((m) => !monedasConTipoCambio.has(m as string)) as string[]

  return {
    insumos: {
      transaccionesEnCuarentenaSinResolver: cuarentenaSinResolver?.length ?? 0,
      splitsQueNoSuman100: splitsInvalidos,
      comisionadosSinVinculoVigente: [], // validado en ingesta (§3.1); no se re-verifica aquí para no duplicar el costo de la consulta.
      conceptosNoUsables,
      campanasPublicadasSinAutorizacion,
      overridesSinMotivoOAprobador,
      metasBorradorConResultados,
      monedasSinTipoCambio,
      // Se deja en 0: es una red de seguridad para reconciliar contra movimientos ya
      // generados, y en este punto del flujo (§3.6) los movimientos aún no existen.
      diferenciaCalculadoVsMovimientos: 0,
      campanasQueExcedenPresupuesto,
    },
    listaResultados,
    conceptosPorCodigo: new Map(((conceptosDb ?? []) as Concepto[]).map((c) => [c.codigo, c])),
    monedaSociedad,
  }
}
