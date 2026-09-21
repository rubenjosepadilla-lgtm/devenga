import { createClient } from '@/lib/supabase/server'
import { SimuladorForm } from './SimuladorForm'

export default async function SimuladorPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: comisionado } = await supabase
    .from('comisionados')
    .select('id_comisionado, pais, tenant_id')
    .eq('usuario_id', user!.id)
    .single()

  if (!comisionado) return null

  // Obtener plan activo del comisionado
  const { data: asignaciones } = await supabase
    .from('asignaciones_plan')
    .select('*, plantillas_plan(nombre, id_plantilla, componentes_plan(*))')
    .eq('comisionado_id', comisionado.id_comisionado)
    .is('vigencia_hasta', null)
    .order('vigencia_desde', { ascending: false })
    .limit(1)

  const asignacion = asignaciones?.[0]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plan = (asignacion as any)?.plantillas_plan
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const componentes = (plan?.componentes_plan ?? []) as any[]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">¿Cuánto ganaría si…?</h1>
        <p className="text-sm text-gray-500 mt-1">
          Simulador de comisión proyectada. Basado en tu plan vigente — el resultado es una estimación y no constituye devengo.
        </p>
      </div>

      {!plan ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400 text-sm">
          No hay un plan asignado activo para simular.
        </div>
      ) : (
        <SimuladorForm nombrePlan={plan.nombre} componentes={componentes} />
      )}
    </div>
  )
}
