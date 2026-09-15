import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/** §2.7/§4.4 — quien cargó la meta la envía a aprobación. La RLS exige el rol carga_metas y que esté en borrador. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { error } = await supabase.from('metas').update({ estado: 'en_aprobacion' }).eq('id_meta', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 409 })
  return NextResponse.json({ estado: 'en_aprobacion' })
}
