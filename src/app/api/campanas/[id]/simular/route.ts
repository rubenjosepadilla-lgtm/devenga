import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { obtenerBaseDiariaCampana } from '@/lib/datos/base-campana'
import { simularCampana } from '@/lib/motor/simulacion'
import { matrizLegalDe } from '@/lib/dominio/matriz-legal'
import type { CodigoPais } from '@/lib/dominio/tipos'

/**
 * §3.5 (2) — simulación de campaña: costo proyectado bajo los dos valores de
 * alcance_retroactivo, y qué beneficios derivados del país quedan afectados.
 * Se corre antes de autorizar (puerta 3, §4.1).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: campana } = await supabase.from('campanas').select('*').eq('id_campana', id).single()
  if (!campana) return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 })

  const { data: concepto } = await supabase.from('conceptos').select('*').eq('codigo', campana.concepto_codigo).single()
  if (!concepto) return NextResponse.json({ error: `Concepto ${campana.concepto_codigo} no encontrado` }, { status: 404 })

  const baseDiaria = await obtenerBaseDiariaCampana(supabase, campana)
  if (baseDiaria.length === 0) {
    return NextResponse.json({
      error: 'Sin resultados de cálculo para este concepto en el período de la campaña — ejecuta el cálculo del período primero para poder simular (§3.5)',
    }, { status: 409 })
  }

  const simulacion = simularCampana(baseDiaria, campana)

  const matriz = matrizLegalDe(concepto.pais as CodigoPais)
  const beneficiosAfectados = matriz.incidencias.filter((i) => (concepto.incide_en as string[]).includes(i.beneficio))

  return NextResponse.json({
    campana: { id_campana: campana.id_campana, multiplicador: campana.multiplicador, monto: campana.monto, presupuesto_tope: campana.presupuesto_tope },
    simulacion,
    beneficios_afectados: beneficiosAfectados,
    advertencia: 'todo_el_periodo_abierto cambia la base de estos beneficios derivados para el mes completo, no solo desde la publicación (§2.8).',
  })
}
