import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calcularPeriodo } from '@/lib/motor/orquestador'
import { finDeMes } from '@/lib/dominio/fase1/periodo'
import type { TransaccionSplit } from '@/lib/dominio/fase1/transaccion'

/** §3.3 — cálculo del período. Ejecución incremental: puede correr varias veces mientras el período está abierto. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: periodo, error: errorPeriodo } = await supabase.from('periodos').select('*').eq('id', id).single()
  if (errorPeriodo || !periodo) return NextResponse.json({ error: 'Período no encontrado' }, { status: 404 })
  if (periodo.estado !== 'abierto') {
    return NextResponse.json({ error: `El período está en estado "${periodo.estado}" — solo se puede calcular un período abierto` }, { status: 409 })
  }

  await supabase.from('periodos').update({ estado: 'en_calculo' }).eq('id', id)

  const { data: sociedad } = await supabase.from('sociedades').select('pais').eq('id_sociedad', periodo.sociedad_id).single()
  const { data: paisRow } = await supabase.from('paises').select('moneda_funcional').eq('codigo_pais', sociedad?.pais).single()
  const monedaSociedad = paisRow?.moneda_funcional ?? 'CLP'

  const inicioPeriodo = `${periodo.periodo}-01`
  const finPeriodo = finDeMes(periodo.periodo)

  const { data: transacciones, error: errorTransacciones } = await supabase
    .from('transacciones')
    .select('*')
    .eq('sociedad_id', periodo.sociedad_id)
    .eq('estado', 'valida')
    .gte('fecha_hecho', inicioPeriodo)
    .lte('fecha_hecho', finPeriodo)

  if (errorTransacciones) {
    await supabase.from('periodos').update({ estado: 'abierto' }).eq('id', id)
    return NextResponse.json({ error: errorTransacciones.message }, { status: 500 })
  }

  const idsTransacciones = (transacciones ?? []).map((t) => t.id_transaccion)
  const { data: splits } = idsTransacciones.length
    ? await supabase.from('transaccion_splits').select('*').in('transaccion_id', idsTransacciones)
    : { data: [] }

  const splitsPorTransaccion: Record<string, TransaccionSplit[]> = {}
  for (const s of splits ?? []) {
    ;(splitsPorTransaccion[s.transaccion_id] ??= []).push({ comisionado_id: s.comisionado_id, porcentaje: s.porcentaje })
  }

  const [{ data: nodos }, { data: plantillas }, { data: metas }, { data: campanas }, { data: tiposCambio }, { data: conceptos }] = await Promise.all([
    supabase.from('nodos_jerarquia').select('*').eq('sociedad_id', periodo.sociedad_id),
    supabase.from('plantillas_plan').select('*, componentes_plan(*), asignaciones_plan(*)').eq('sociedad_id', periodo.sociedad_id).in('estado', ['aprobado', 'vigente']),
    supabase.from('metas').select('*').eq('sociedad_id', periodo.sociedad_id).eq('periodo', periodo.periodo),
    supabase.from('campanas').select('*').eq('sociedad_id', periodo.sociedad_id).eq('estado', 'publicada'),
    supabase.from('tipos_cambio').select('*').eq('periodo', periodo.periodo),
    supabase.from('conceptos').select('*'),
  ])

  const componentes = (plantillas ?? []).flatMap((p) => p.componentes_plan ?? [])
  const asignaciones = (plantillas ?? []).flatMap((p) => p.asignaciones_plan ?? [])

  const resultadoCalculo = calcularPeriodo({
    periodoId: periodo.id,
    periodo: periodo.periodo,
    sociedadId: periodo.sociedad_id,
    monedaSociedad,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transacciones: (transacciones ?? []) as any,
    splitsPorTransaccion,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    nodos: (nodos ?? []) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    plantillas: (plantillas ?? []) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    componentes: componentes as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    asignaciones: asignaciones as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metas: (metas ?? []) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    campanas: (campanas ?? []) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tiposCambio: (tiposCambio ?? []) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    conceptos: (conceptos ?? []) as any,
    generarId: randomUUID,
  })

  // Recálculo incremental: se reemplazan los créditos y resultados preliminares
  // de las transacciones/período tocados — el período aún no está congelado.
  if (idsTransacciones.length > 0) {
    await supabase.from('creditos').delete().in('transaccion_id', idsTransacciones)
    if (resultadoCalculo.creditos.length > 0) {
      const { error: errorCreditos } = await supabase.from('creditos').insert(
        resultadoCalculo.creditos.map((c) => ({
          id_credito: c.id_credito,
          transaccion_id: c.transaccion_id,
          comisionado_id: c.comisionado_id,
          porcentaje_split: c.porcentaje_split,
          monto_atribuido: c.monto_atribuido,
          fecha_credito: c.fecha_credito,
          nodo_id: c.nodo_id ?? null,
          snapshot_jerarquia: c.snapshot_jerarquia,
        }))
      )
      if (errorCreditos) {
        await supabase.from('periodos').update({ estado: 'abierto' }).eq('id', id)
        return NextResponse.json({ error: `Error al guardar créditos: ${errorCreditos.message}` }, { status: 500 })
      }
    }
  }

  await supabase.from('resultados_calculo').delete().eq('periodo_id', periodo.id).eq('estado', 'preliminar')
  if (resultadoCalculo.resultados.length > 0) {
    const { error: errorResultados } = await supabase.from('resultados_calculo').insert(
      resultadoCalculo.resultados.map((r) => ({
        id_resultado: r.id_resultado,
        periodo_id: r.periodo_id,
        comisionado_id: r.comisionado_id,
        sociedad_id: r.sociedad_id,
        concepto_codigo: r.concepto_codigo,
        plantilla_id: r.plantilla_id,
        componente_id: r.componente_id,
        importe: r.importe,
        moneda: r.moneda,
        detalle_diario: r.detalle_diario ?? null,
        snapshot: r.snapshot,
        estado: 'preliminar',
      }))
    )
    if (errorResultados) {
      await supabase.from('periodos').update({ estado: 'abierto' }).eq('id', id)
      return NextResponse.json({ error: `Error al guardar resultados: ${errorResultados.message}` }, { status: 500 })
    }
  }

  await supabase.from('periodos').update({ estado: 'abierto' }).eq('id', id)

  return NextResponse.json({
    creditos: resultadoCalculo.creditos.length,
    resultados: resultadoCalculo.resultados.length,
    total: resultadoCalculo.resultados.reduce((acc, r) => acc + r.importe, 0),
    errores: resultadoCalculo.errores,
  })
}
