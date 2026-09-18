import { randomUUID, createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { evaluarControlesBloqueantes } from '@/lib/motor/cierre'
import { construirMovimientoDevengo } from '@/lib/motor/movimiento'
import { prepararDatosCierre } from '@/lib/datos/insumos-cierre'
import { movimientoParaFila } from '@/lib/datos/mapeo'

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

  // Construye y valida los movimientos ANTES de tocar la base — si algo falla
  // acá, resultados_calculo se queda en 'preliminar' y un reintento vuelve a
  // procesar todo desde cero. Congelar antes de generar los movimientos (como
  // hacía esta ruta originalmente) dejaba resultados en 'congelado' sin
  // movimiento si el paso siguiente fallaba, y como el cierre solo busca
  // resultados 'preliminar', un reintento ya no los encontraba — quedaban
  // huérfanos y el período se podía marcar "cerrado" con 0 movimientos.
  const porInsertar: { idResultado: string; movimiento: ReturnType<typeof construirMovimientoDevengo>['movimiento'] }[] = []
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
    porInsertar.push({ idResultado: resultado.id_resultado, movimiento })
  }

  if (erroresMovimiento.length > 0) {
    return NextResponse.json({ error: 'Movimientos inválidos — ningún resultado fue tocado, se puede reintentar (§3.8)', detalle: erroresMovimiento }, { status: 500 })
  }

  if (porInsertar.length > 0) {
    const { error: errorMovimientos } = await supabase.from('movimientos_devengo').insert(porInsertar.map((p) => movimientoParaFila(p.movimiento)))
    if (errorMovimientos) return NextResponse.json({ error: errorMovimientos.message }, { status: 500 })

    for (const { idResultado, movimiento } of porInsertar) {
      await supabase.from('resultados_calculo').update({ estado: 'congelado', id_movimiento: movimiento.id_movimiento }).eq('id_resultado', idResultado)
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

  return NextResponse.json({ estado: 'cerrado', movimientos_generados: porInsertar.length })
}
