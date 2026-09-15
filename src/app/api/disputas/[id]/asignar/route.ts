import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/** §3.10 — asignación. Solo quien tiene el rol resuelve_disputas (o admin) puede asignar, vía RLS. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const asignadoA = typeof body.asignado_a === 'string' && body.asignado_a ? body.asignado_a : user.email

  const { error } = await supabase.from('disputas').update({ estado: 'asignada', asignado_a: asignadoA }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 409 })
  return NextResponse.json({ estado: 'asignada' })
}
