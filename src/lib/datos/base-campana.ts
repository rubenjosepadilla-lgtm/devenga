import type { SupabaseClient } from '@supabase/supabase-js'
import type { ImporteDiario } from '@/lib/motor/simulacion'

/**
 * Junta el detalle diario ya calculado (pre-campaña) para el concepto de una
 * campaña, sumado entre todos los comisionados del período. Simplificación
 * declarada: asume que la campaña vive dentro de un solo período (busca el
 * período cuyo `periodo` coincide con el mes de `vigencia_hecho_desde`) — una
 * campaña que cruza dos meses calendario no está cubierta todavía.
 */
export async function obtenerBaseDiariaCampana(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  campana: { sociedad_id: string; concepto_codigo: string; vigencia_hecho_desde: string }
): Promise<ImporteDiario[]> {
  const mesCampana = campana.vigencia_hecho_desde.slice(0, 7)

  const { data: periodo } = await supabase
    .from('periodos')
    .select('id')
    .eq('sociedad_id', campana.sociedad_id)
    .eq('periodo', mesCampana)
    .maybeSingle()

  if (!periodo) return []

  const { data: resultados } = await supabase
    .from('resultados_calculo')
    .select('detalle_diario')
    .eq('periodo_id', periodo.id)
    .eq('concepto_codigo', campana.concepto_codigo)

  const porDia = new Map<string, number>()
  for (const r of resultados ?? []) {
    for (const d of (r.detalle_diario ?? []) as ImporteDiario[]) {
      porDia.set(d.fecha, (porDia.get(d.fecha) ?? 0) + d.importe)
    }
  }

  return Array.from(porDia.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([fecha, importe]) => ({ fecha, importe }))
}
