import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const BodySchema = z.object({
  monto_bruto_pagado: z.number(),
  estado: z.enum(['acusado', 'pagado']),
  id_documento_publicado: z.string(),
  fecha: z.string(),
  declarado_no_confirmado: z.boolean().default(false),
})

/**
 * §3.9 — acuse desde la nómina (vuelta). Puerta 6 (§4.1): sin acuse, el
 * movimiento queda "enviado" y el portal muestra "aprobado, pendiente de
 * pago", nunca "pagado". En modo Excel/manual, `declarado_no_confirmado`
 * dice que la cadena de evidencia queda coja en este tramo — limitación
 * declarada, no defecto oculto (§3.9).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const parsed = BodySchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Payload inválido', detalle: parsed.error.flatten() }, { status: 400 })
  const body = parsed.data

  const { data: movimiento } = await supabase.from('movimientos_devengo').select('id_movimiento').eq('id_movimiento', id).single()
  if (!movimiento) return NextResponse.json({ error: 'Movimiento no encontrado' }, { status: 404 })

  const { error: errorAcuse } = await supabase.from('acuses_nomina').insert({ id_movimiento: id, periodo_liquidado: body.fecha.slice(0, 7), ...body })
  if (errorAcuse) return NextResponse.json({ error: errorAcuse.message }, { status: 500 })

  const { error: errorMovimiento } = await supabase.from('movimientos_devengo').update({ estado: body.estado }).eq('id_movimiento', id)
  if (errorMovimiento) return NextResponse.json({ error: errorMovimiento.message }, { status: 500 })

  return NextResponse.json({ estado: body.estado })
}
