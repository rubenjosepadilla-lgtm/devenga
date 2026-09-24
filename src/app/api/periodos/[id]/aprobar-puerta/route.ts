import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * §4.1 — Aprueba una puerta del workflow de cierre de período.
 * Avanza el estado del período según la puerta aprobada.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { puerta_numero, comentario } = await request.json()
  if (!puerta_numero) return NextResponse.json({ error: 'puerta_numero es requerido' }, { status: 400 })

  const { data, error } = await supabase.rpc('aprobar_puerta_periodo', {
    p_periodo_id: id,
    p_puerta_numero: puerta_numero,
    p_comentario: comentario ?? null,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
