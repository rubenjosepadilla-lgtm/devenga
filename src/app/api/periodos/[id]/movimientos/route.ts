import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { MovimientoDevengo } from '@/lib/dominio/movimiento-devengo'

/**
 * §6 — modo archivo: exporta los movimientos de devengo de un período
 * congelado/cerrado. Mismo objeto (§3.8) que el modo API entrega, serializado.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: periodo } = await supabase.from('periodos').select('*').eq('id', id).single()
  if (!periodo) return NextResponse.json({ error: 'Período no encontrado' }, { status: 404 })

  const { data: resultados } = await supabase.from('resultados_calculo').select('id_movimiento').eq('periodo_id', id).not('id_movimiento', 'is', null)
  const idsMovimientos = (resultados ?? []).map((r) => r.id_movimiento).filter(Boolean) as string[]

  const { data: movimientos } = idsMovimientos.length
    ? await supabase.from('movimientos_devengo').select('*').in('id_movimiento', idsMovimientos)
    : { data: [] }

  const formato = new URL(request.url).searchParams.get('formato') ?? 'json'

  if (formato === 'csv') {
    const filas = (movimientos ?? []) as MovimientoDevengo[]
    const encabezado = [
      'id_movimiento', 'comisionado', 'sociedad', 'pais', 'concepto', 'importe', 'moneda',
      'periodo_origen', 'periodo_imputacion', 'devengo_diario', 'remunerativo', 'incide_en', 'estado',
    ]
    const lineas = filas.map((m) =>
      [m.id_movimiento, m.comisionado, m.sociedad, m.pais, m.concepto, m.importe, m.moneda,
        m.periodo_origen, m.periodo_imputacion, m.devengo_diario, m.remunerativo, m.incide_en.join('|'), m.estado]
        .join(',')
    )
    const csv = [encabezado.join(','), ...lineas].join('\n')
    return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="movimientos_${periodo.periodo}.csv"` } })
  }

  return NextResponse.json({ periodo: periodo.periodo, movimientos: movimientos ?? [] })
}
