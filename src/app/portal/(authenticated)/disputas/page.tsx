import { createClient } from '@/lib/supabase/server'
import { AbrirDisputaForm } from './AbrirDisputaForm'

const ETIQUETA_ESTADO: Record<string, string> = {
  abierta: 'Abierta',
  asignada: 'Asignada',
  en_resolucion: 'En resolución',
  resuelta: 'Resuelta',
  rechazada: 'Rechazada',
}

export default async function PortalDisputasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: comisionado } = await supabase.from('comisionados').select('id_comisionado').eq('usuario_id', user!.id).single()
  const comisionadoId = comisionado!.id_comisionado

  const { data: vinculo } = await supabase.from('comisionado_sociedad').select('sociedad_id').eq('comisionado_id', comisionadoId).limit(1).maybeSingle()

  const [{ data: disputas }, { data: resultados }] = await Promise.all([
    supabase.from('disputas').select('*').eq('comisionado_id', comisionadoId).order('created_at', { ascending: false }),
    supabase.from('resultados_calculo').select('id_resultado, concepto_codigo, importe, moneda').eq('comisionado_id', comisionadoId).order('created_at', { ascending: false }).limit(20),
  ])

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-xl font-semibold text-gray-900 mb-4">Mis disputas</h1>
        <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100">
          {(disputas ?? []).map((d) => (
            <div key={d.id} className="p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-900">{d.clasificacion} — {d.descripcion}</span>
                <span className="text-gray-500">{ETIQUETA_ESTADO[d.estado]}</span>
              </div>
              {d.motivo_resolucion && <p className="text-xs text-gray-400 mt-1">Resolución: {d.motivo_resolucion}</p>}
            </div>
          ))}
          {(disputas ?? []).length === 0 && <p className="p-4 text-sm text-gray-400">Sin disputas abiertas.</p>}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Abrir una disputa</h2>
        <div className="bg-white rounded-2xl border border-gray-100 p-6 max-w-lg">
          {vinculo ? (
            <AbrirDisputaForm comisionadoId={comisionadoId} sociedadId={vinculo.sociedad_id} resultados={resultados ?? []} />
          ) : (
            <p className="text-sm text-gray-400">Sin vínculo a una sociedad todavía.</p>
          )}
        </div>
      </section>
    </div>
  )
}
