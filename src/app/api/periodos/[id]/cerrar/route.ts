import { randomUUID, createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { evaluarControlesBloqueantes } from '@/lib/motor/cierre'
import { construirMovimientoDevengo } from '@/lib/motor/movimiento'
import { prepararDatosCierre } from '@/lib/datos/insumos-cierre'

/**
 * §3.6/§4.1/§4.2 — cierra un período: evalúa los diez controles bloqueantes,
 * si pasan congela los resultados (puerta 4) y genera los movimientos de
 * devengo (§3.8), y deja evidencia de la puerta 5 (aprobación de liquidación)
 * en el mismo paso — ver docs/fase-1/00-resumen.md para la simplificación
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

  const { insumos, listaResultados, conceptosPorCodigo } = await prepararDatosCierre(supabase, periodo)

  const violaciones = evaluarControlesBloqueantes(insumos)
  if (violaciones.length > 0) {
    return NextResponse.json({ error: 'El período no puede cerrarse — controles bloqueantes activos (§4.2)', violaciones }, { status: 409 })
  }

  const congeladoHash = createHash('sha256')
    .update(JSON.stringify(listaResultados.map((r) => ({ id: r.id_resultado, importe: r.importe }))))
    .digest('hex')
  const ahora = new Date().toISOString()

  await supabase.from('resultados_calculo').update({ estado: 'congelado' }).eq('periodo_id', id).eq('estado', 'preliminar')

  const movimientosAInsertar = []
  const erroresMovimiento: string[] = []

  for (const resultado of listaResultados) {
    const concepto = conceptosPorCodigo.get(resultado.concepto_codigo)
    if (!concepto) { erroresMovimiento.push(`concepto ${resultado.concepto_codigo} no encontrado`); continue }

    const { movimiento, errores } = construirMovimientoDevengo({
      resultado,
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
