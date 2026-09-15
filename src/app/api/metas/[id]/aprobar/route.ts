import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/** §2.7/§4.4 — aprueba una meta en_aprobacion. Nunca la misma persona que la cargó (RLS: rol aprueba_metas). */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { error } = await supabase
    .from('metas')
    .update({ estado: 'vigente', aprobada_por: user.email, aprobada_en: new Date().toISOString() })
    .eq('id_meta', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 409 })
  return NextResponse.json({ estado: 'vigente' })
}
