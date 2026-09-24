import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { obtenerBaseDiariaCampana } from '@/lib/datos/base-campana'
import { simularCampana, costoProyectadoSegunAlcance } from '@/lib/motor/simulacion'

/**
 * §2.8 regla 3 — una campaña no autorizada no se publica. §2.8 regla 4 — el
 * motor valida presupuesto_tope contra el devengo proyectado y bloquea la
 * publicación si lo excede sin autorización de nivel superior. Si no hay
 * base calculada todavía (campaña publicada antes de que existan ventas del
 * mes, el caso normal), el proyectado es 0 y nunca bloquea.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const motivoExcepcion = typeof body.excepcion_motivo === 'string' ? body.excepcion_motivo : undefined

  const { data: campana } = await supabase.from('campanas').select('*').eq('id_campana', id).single()
  if (!campana) return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 })
  if (campana.estado !== 'autorizada') return NextResponse.json({ error: `No se puede publicar una campaña en estado "${campana.estado}" (§2.8 regla 3)` }, { status: 409 })

  const baseDiaria = await obtenerBaseDiariaCampana(supabase, campana)
  const proyectado = baseDiaria.length > 0 ? costoProyectadoSegunAlcance(simularCampana(baseDiaria, campana), campana.alcance_retroactivo) : 0

  if (proyectado > campana.presupuesto_tope) {
    if (!motivoExcepcion || motivoExcepcion.trim().length < 20) {
      return NextResponse.json({
        error: `Devengo proyectado (${proyectado}) excede presupuesto_tope (${campana.presupuesto_tope}) — publicar requiere autorización de nivel superior con motivo (§2.8 regla 4, §4.2)`,
        proyectado,
        presupuesto_tope: campana.presupuesto_tope,
        requiere_excepcion: true,
      }, { status: 409 })
    }

    await supabase.from('campanas').update({
      excepcion_presupuesto_motivo: motivoExcepcion,
      excepcion_presupuesto_autorizado_por: user.email,
      excepcion_presupuesto_en: new Date().toISOString(),
    }).eq('id_campana', id)
  }

  const { error } = await supabase
    .from('campanas')
    .update({ estado: 'publicada', fecha_publicacion: new Date().toISOString().slice(0, 10) })
    .eq('id_campana', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ estado: 'publicada', proyectado })
}
