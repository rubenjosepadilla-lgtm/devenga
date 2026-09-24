import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/** Puerta 3 (§4.1) — autoriza una campaña en borrador. No la publica todavía (§2.8 regla 3). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const nivelAutorizacion = typeof body.nivel_autorizacion === 'string' && body.nivel_autorizacion ? body.nivel_autorizacion : 'jefatura_comercial'

  const { data: campana } = await supabase.from('campanas').select('estado').eq('id_campana', id).single()
  if (!campana) return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 })
  if (campana.estado !== 'borrador') return NextResponse.json({ error: `No se puede autorizar una campaña en estado "${campana.estado}"` }, { status: 409 })

  const { error } = await supabase
    .from('campanas')
    .update({ estado: 'autorizada', autorizador: user.email, nivel_autorizacion: nivelAutorizacion, autorizado_en: new Date().toISOString() })
    .eq('id_campana', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ estado: 'autorizada' })
}
