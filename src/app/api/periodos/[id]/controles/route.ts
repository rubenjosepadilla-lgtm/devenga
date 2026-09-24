import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { evaluarControlesBloqueantes } from '@/lib/motor/cierre'
import { prepararDatosCierre } from '@/lib/datos/insumos-cierre'

/**
 * §4.2 — vista previa de los controles bloqueantes, sin cerrar nada. Deja
 * ver por qué un período no podría cerrarse todavía antes de intentarlo.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: periodo } = await supabase.from('periodos').select('*').eq('id', id).single()
  if (!periodo) return NextResponse.json({ error: 'Período no encontrado' }, { status: 404 })

  const { insumos } = await prepararDatosCierre(supabase, periodo)
  const violaciones = evaluarControlesBloqueantes(insumos)

  return NextResponse.json({ listo_para_cerrar: violaciones.length === 0, violaciones })
}
