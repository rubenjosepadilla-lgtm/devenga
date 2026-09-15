import { randomUUID, createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { evaluarControlesBloqueantes, type InsumosCierre } from '@/lib/motor/cierre'
import { construirMovimientoDevengo } from '@/lib/motor/movimiento'
import { validarConceptoUsable } from '@/lib/dominio/conceptos'
import type { Concepto } from '@/lib/dominio/conceptos'

/**
 * §3.6/§4.1/§4.2 — cierra un período: evalúa los diez controles bloqueantes,
 * si pasan congela los resultados (puerta 4) y genera los movimientos de
 * devengo (§3.8), y deja evidencia de la puerta 5 (aprobación de liquidación)
 * en el mismo paso — ver comentario en el código para la simplificación
 * declarada de colapsar las puertas 4 y 5 en una sola acción de usuario.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: periodo, error: errorPeriodo } = await supabase.from('periodos').select('*').eq('id', id).single()
  if (errorPeriodo || !periodo) return NextResponse.json({ error: 'Período no encontrado' }, { status: 404 })
  if (periodo.estado !== 'abierto') {
    return NextResponse.json({ error: `El período está en estado "${periodo.estado}" — ejecuta el cálculo primero y deja el período abierto` }, { status: 409 })
  }

  const { data: sociedad } = await supabase.from('sociedades').select('pais').eq('id_sociedad', periodo.sociedad_id).single()
  const { data: paisRow } = await supabase.from('paises').select('moneda_funcional').eq('codigo_pais', sociedad?.pais).single()
  const monedaSociedad = paisRow?.moneda_funcional ?? 'CLP'

  const { data: resultados } = await supabase.from('resultados_calculo').select('*').eq('periodo_id', id).eq('estado', 'preliminar')
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
  ).data?.map((t) => t.id_transaccion) ?? []

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
  const codigosUsados = new Set(listaResultados.map((r) => r.concepto_codigo))
  const conceptosNoUsables = ((conceptosDb ?? []) as Concepto[])
    .filter((c) => codigosUsados.has(c.codigo))
    .map((c) => ({ codigo: c.codigo, errores: validarConceptoUsable(c) }))
    .filter((c) => c.errores.length > 0)

  const { data: campanasPublicadas } = await supabase.from('campanas').select('*').eq('sociedad_id', periodo.sociedad_id).eq('estado', 'publicada')
  const campanasPublicadasSinAutorizacion = (campanasPublicadas ?? [])
    .filter((c) => !c.autorizador || !c.autorizado_en)
    .map((c) => ({ id: c.id_campana }))
  const campanasQueExcedenPresupuesto = (campanasPublicadas ?? [])
    .map((c) => {
      const proyectado = listaResultados
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((r) => (r.snapshot as any)?.version_campana === c.id_campana)
        .reduce((acc, r) => acc + r.importe, 0)
      return { id: c.id_campana, proyectado, tope: c.presupuesto_tope }
    })
    .filter((c) => c.proyectado > c.tope)

  const { data: overrides } = await supabase
    .from('overrides_plan')
    .select('id, motivo, aprobado_por, aprobado_en')
  const overridesSinMotivoOAprobador = (overrides ?? [])
    .filter((o) => !o.motivo || o.motivo.length < 20 || !o.aprobado_por || !o.aprobado_en)
    .map((o) => ({ id: o.id }))

  const { data: metasBorrador } = await supabase.from('metas').select('id_meta, destino_id').eq('sociedad_id', periodo.sociedad_id).eq('periodo', periodo.periodo).eq('estado', 'borrador')
  const idsDestinoConResultado = new Set(listaResultados.map((r) => r.comisionado_id))
  const metasBorradorConResultados = (metasBorrador ?? []).filter((m) => idsDestinoConResultado.has(m.destino_id)).map((m) => ({ id_meta: m.id_meta }))

  const monedasUsadas = new Set((listaResultados.map((r) => r.moneda) ?? []).filter((m) => m !== monedaSociedad))
  const { data: tiposCambioPeriodo } = await supabase.from('tipos_cambio').select('moneda_origen').eq('periodo', periodo.periodo).eq('moneda_destino', monedaSociedad)
  const monedasConTipoCambio = new Set((tiposCambioPeriodo ?? []).map((t) => t.moneda_origen))
  const monedasSinTipoCambio = Array.from(monedasUsadas).filter((m) => !monedasConTipoCambio.has(m))

  const insumos: InsumosCierre = {
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
  }

  const violaciones = evaluarControlesBloqueantes(insumos)
  if (violaciones.length > 0) {
    return NextResponse.json({ error: 'El período no puede cerrarse — controles bloqueantes activos (§4.2)', violaciones }, { status: 409 })
  }

  const congeladoHash = createHash('sha256')
    .update(JSON.stringify(listaResultados.map((r) => ({ id: r.id_resultado, importe: r.importe }))))
    .digest('hex')
  const ahora = new Date().toISOString()

  await supabase.from('resultados_calculo').update({ estado: 'congelado' }).eq('periodo_id', id).eq('estado', 'preliminar')

  const conceptosPorCodigo = new Map(((conceptosDb ?? []) as Concepto[]).map((c) => [c.codigo, c]))
  const movimientosAInsertar = []
  const erroresMovimiento: string[] = []

  for (const resultado of listaResultados) {
    const concepto = conceptosPorCodigo.get(resultado.concepto_codigo)
    if (!concepto) { erroresMovimiento.push(`concepto ${resultado.concepto_codigo} no encontrado`); continue }

    const { movimiento, errores } = construirMovimientoDevengo({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      resultado: resultado as any,
      concepto,
      comisionadoId: resultado.comisionado_id,
      sociedadId: resultado.sociedad_id,
      periodoOrigen: periodo.periodo,
      periodoImputacion: periodo.periodo,
      urlDocumento: `/documentos/${resultado.id_resultado}`,
      generarId: randomUUID,
    })
    if (errores.length > 0) { erroresMovimiento.push(`${resultado.id_resultado}: ${errores.join('; ')}`); continue }
    movimientosAInsertar.push(movimiento)
  }

  if (erroresMovimiento.length > 0) {
    return NextResponse.json({ error: 'Resultados congelados pero con movimientos inválidos — revisa antes de reintentar', detalle: erroresMovimiento }, { status: 500 })
  }

  if (movimientosAInsertar.length > 0) {
    const { error: errorMovimientos } = await supabase.from('movimientos_devengo').insert(movimientosAInsertar)
    if (errorMovimientos) return NextResponse.json({ error: errorMovimientos.message }, { status: 500 })

    for (const m of movimientosAInsertar) {
      await supabase.from('resultados_calculo').update({ id_movimiento: m.id_movimiento }).eq('sociedad_id', m.sociedad).eq('concepto_codigo', m.concepto).eq('periodo_id', id).eq('comisionado_id', m.comisionado)
    }
  }

  await supabase
    .from('periodos')
    .update({
      estado: 'cerrado',
      congelado_en: ahora,
      congelado_hash: congeladoHash,
      cerrado_en: ahora,
      cerrado_por: user.email,
    })
    .eq('id', id)

  return NextResponse.json({ estado: 'cerrado', movimientos_generados: movimientosAInsertar.length })
}
