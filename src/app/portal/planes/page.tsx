import { createClient } from '@/lib/supabase/server'
import { AceptarPlanForm } from './AceptarPlanForm'

export default async function PortalPlanesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: comisionado } = await supabase
    .from('comisionados')
    .select('id_comisionado')
    .eq('usuario_id', user!.id)
    .single()

  if (!comisionado) return null

  const { data: acuses } = await supabase.rpc('obtener_mis_acuses_plan')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lista = (acuses as any[] | null) ?? []

  const ESTADO_LABEL: Record<string, string> = {
    pendiente: 'Pendiente de aceptar',
    aceptado: 'Aceptado',
    rechazado: 'Rechazado',
  }
  const ESTADO_CLASE: Record<string, string> = {
    pendiente: 'bg-amber-50 text-amber-700',
    aceptado: 'bg-green-50 text-green-700',
    rechazado: 'bg-red-50 text-red-700',
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Mis planes de comisiones</h1>

      {lista.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400 text-sm">
          No hay planes asignados todavía.
        </div>
      )}

      {lista.map((a) => (
        <div key={a.id_acuse} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 flex items-center justify-between border-b border-gray-100">
            <div>
              <p className="font-semibold text-gray-900">{a.nombre_plan}</p>
              <p className="text-xs text-gray-400 mt-0.5">Versión {a.version_plan} · Asignado el {new Date(a.created_at).toLocaleDateString('es-CL')}</p>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_CLASE[a.estado] ?? 'bg-gray-100 text-gray-600'}`}>
              {ESTADO_LABEL[a.estado] ?? a.estado}
            </span>
          </div>
          <div className="px-6 py-5">
            {a.estado === 'pendiente' && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Debes revisar tu esquema de comisiones y confirmar que lo conoces y aceptas.
                  Al aceptar, queda un registro con fecha, hora e IP.
                </p>
                <p className="text-xs text-amber-600">
                  Si rechazas, el sistema notificará a tu jefe. El plan rechazado no puede calcular comisiones hasta que se resuelva.
                </p>
                <AceptarPlanForm acuseId={a.id_acuse} />
              </div>
            )}
            {a.estado === 'aceptado' && (
              <p className="text-sm text-gray-500">
                Aceptado el {new Date(a.aceptado_en).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
            {a.estado === 'rechazado' && (
              <div>
                <p className="text-sm text-gray-500">Rechazado.</p>
                {a.motivo_rechazo && <p className="text-sm text-red-600 mt-1">Motivo: {a.motivo_rechazo}</p>}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
