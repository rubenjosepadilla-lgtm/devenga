import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { sociedadesDelUsuario } from '@/lib/datos/sociedad-activa'
import { crearPeriodo } from './actions'

const COLOR_ESTADO: Record<string, string> = {
  abierto: 'bg-blue-50 text-blue-700',
  en_calculo: 'bg-orange-50 text-orange-700',
  congelado: 'bg-violet-50 text-violet-700',
  cerrado: 'bg-green-50 text-green-700',
}

export default async function PeriodosPage() {
  const supabase = await createClient()
  const sociedades = await sociedadesDelUsuario()

  const { data: periodos } = await supabase.from('periodos').select('*, sociedades(nombre)').order('periodo', { ascending: false })

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-8">Períodos</h1>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-8">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Sociedad</th>
              <th className="px-4 py-3 font-medium">Período</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(periodos ?? []).map((p: any) => (
              <tr key={p.id} className="border-t border-gray-100">
                <td className="px-4 py-3 text-gray-500">{p.sociedades?.nombre}</td>
                <td className="px-4 py-3 text-gray-900">{p.periodo}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full ${COLOR_ESTADO[p.estado] ?? 'bg-gray-50 text-gray-600'}`}>{p.estado}</span>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/dashboard/periodos/${p.id}`} className="text-violet-700 hover:underline">Ver →</Link>
                </td>
              </tr>
            ))}
            {(periodos ?? []).length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">Aún no hay períodos.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6 max-w-lg">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Nuevo período</h2>
        {sociedades.length === 0 ? (
          <p className="text-sm text-gray-400">Crea primero una sociedad.</p>
        ) : (
          <form action={crearPeriodo} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Sociedad</label>
              <select name="sociedad_id" required className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                {sociedades.map((s) => <option key={s.id_sociedad} value={s.id_sociedad}>{s.nombre}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Período (yyyy-mm)</label>
                <input name="periodo" required placeholder="2026-09" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Fecha de corte</label>
                <input type="date" name="fecha_corte" required className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <button type="submit" className="bg-violet-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-violet-800">
              Abrir período
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
