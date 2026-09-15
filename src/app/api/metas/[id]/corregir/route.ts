import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * §2.7 — una meta nunca se edita: se versiona. Crea una nueva fila en la
 * misma serie, con motivo_version obligatorio desde la versión 2.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const magnitud = Number(body.magnitud)
  const motivoVersion = typeof body.motivo_version === 'string' ? body.motivo_version : ''
  if (!motivoVersion || motivoVersion.trim().length === 0) {
    return NextResponse.json({ error: 'motivo_version es obligatorio para corregir una meta (§2.7)' }, { status: 400 })
  }

  const { data: original } = await supabase.from('metas').select('*').eq('id_meta', id).single()
  if (!original) return NextResponse.json({ error: 'Meta no encontrada' }, { status: 404 })

  const { data: nueva, error } = await supabase
    .from('metas')
    .insert({
      sociedad_id: original.sociedad_id,
      serie_id: original.serie_id,
      destino_tipo: original.destino_tipo,
      destino_id: original.destino_id,
      periodo: original.periodo,
      magnitud,
      unidad: original.unidad,
      version: original.version + 1,
      motivo_version: motivoVersion,
      cargada_por: user.email ?? user.id,
      estado: 'borrador',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ meta: nueva })
}
