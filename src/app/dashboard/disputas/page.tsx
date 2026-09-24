import { createClient } from '@/lib/supabase/server'
import { DisputaAcciones } from './DisputaAcciones'

const ETIQUETA_ESTADO: Record<string, string> = {
  abierta: 'Abierta',
  asignada: 'Asignada',
  en_resolucion: 'En resolución',
  resuelta: 'Resuelta',
  rechazada: 'Rechazada',
}

export default async function DisputasPage() {
  const supabase = await createClient()

  const { data: disputas } = await supabase
    .from('disputas')
    .select('*, comisionados(identificador_personal)')
    .order('created_at', { ascending: false })

  const ahora = new Date()

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-8">Disputas (§3.10)</h1>
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Comisionado</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Descripción</th>
              <th className="px-4 py-3 font-medium">SLA</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(disputas ?? []).map((d: any) => {
              const vencida = d.estado !== 'resuelta' && d.estado !== 'rechazada' && new Date(d.sla_vence_en) < ahora
              return (
                <tr key={d.id} className="border-t border-gray-100">
                  <td className="px-4 py-3 text-gray-900">{d.comisionados?.identificador_personal}</td>
                  <td className="px-4 py-3 text-gray-500">{d.clasificacion}</td>
                  <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{d.descripcion}</td>
                  <td className={`px-4 py-3 ${vencida ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                    {new Date(d.sla_vence_en).toLocaleDateString('es-CL')}{vencida ? ' (vencida)' : ''}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{ETIQUETA_ESTADO[d.estado]}</td>
                  <td className="px-4 py-3"><DisputaAcciones disputaId={d.id} estado={d.estado} /></td>
                </tr>
              )
            })}
            {(disputas ?? []).length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Sin disputas.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
