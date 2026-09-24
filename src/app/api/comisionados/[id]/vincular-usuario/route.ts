import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Vincula una cuenta de portal (creada en /portal/register) a un comisionado.
 * Acción de staff, no autoservicio — ver el comentario en schema_fase3.sql
 * sobre por qué no se deja "reclamar" el registro escribiendo el propio
 * identificador personal.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!email) return NextResponse.json({ error: 'email es obligatorio' }, { status: 400 })

  const { data: usuario } = await supabase.from('usuarios_app').select('id').eq('email', email).maybeSingle()
  if (!usuario) return NextResponse.json({ error: `No existe una cuenta de portal con el email ${email} — pide al comisionado que se registre en /portal/register` }, { status: 404 })

  const { error } = await supabase.from('comisionados').update({ usuario_id: usuario.id }).eq('id_comisionado', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 409 })

  return NextResponse.json({ vinculado: true })
}
