import { createClient } from '@/lib/supabase/server'
import { sociedadesDelUsuario } from '@/lib/datos/sociedad-activa'
import { crearMeta } from './actions'
import { MetaAcciones } from './MetaAcciones'

export default async function MetasPage() {
  const supabase = await createClient()
  const sociedades = await sociedadesDelUsuario()

  const { data: metas } = await supabase
    .from('metas')
    .select('*, sociedades(nombre)')
    .order('created_at', { ascending: false })

  const { data: comisionados } = await supabase
    .from('comisionado_sociedad')
    .select('comisionado_id, comisionados(identificador_personal)')

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-8">Metas</h1>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-8">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Sociedad</th>
              <th className="px-4 py-3 font-medium">Destino</th>
              <th className="px-4 py-3 font-medium">Período</th>
              <th className="px-4 py-3 font-medium">Magnitud</th>
              <th className="px-4 py-3 font-medium">Versión</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(metas ?? []).map((m: any) => (
              <tr key={m.id_meta} className="border-t border-gray-100">
                <td className="px-4 py-3 text-gray-500">{m.sociedades?.nombre}</td>
                <td className="px-4 py-3 text-gray-900">{m.destino_tipo}: {m.destino_id.slice(0, 8)}…</td>
                <td className="px-4 py-3 text-gray-500">{m.periodo}</td>
                <td className="px-4 py-3 text-gray-500">{m.magnitud} {m.unidad}</td>
                <td className="px-4 py-3 text-gray-500">v{m.version}{m.motivo_version ? ` — ${m.motivo_version}` : ''}</td>
                <td className="px-4 py-3 text-gray-500">{m.estado}</td>
                <td className="px-4 py-3"><MetaAcciones metaId={m.id_meta} estado={m.estado} /></td>
              </tr>
            ))}
            {(metas ?? []).length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">Aún no hay metas.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6 max-w-xl">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Nueva meta</h2>
        {sociedades.length === 0 ? (
          <p className="text-sm text-gray-400">Crea primero una sociedad.</p>
        ) : (
          <form action={crearMeta} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Sociedad</label>
                <select name="sociedad_id" required className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  {sociedades.map((s) => <option key={s.id_sociedad} value={s.id_sociedad}>{s.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Destino</label>
                <select name="destino_tipo" required className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option value="comisionado">Comisionado</option>
                  <option value="nodo">Nodo de jerarquía</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">ID del comisionado (destino_id)</label>
              <select name="destino_id" required className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {(comisionados ?? []).map((c: any) => (
                  <option key={c.comisionado_id} value={c.comisionado_id}>{c.comisionados?.identificador_personal}</option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">Si el destino es un nodo, pega su UUID directamente (no listado aquí).</p>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Período (yyyy-mm)</label>
                <input name="periodo" required placeholder="2026-09" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Magnitud</label>
                <input type="number" step="0.01" name="magnitud" required className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Unidad</label>
                <input name="unidad" required placeholder="CLP, unidades..." className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <button type="submit" className="bg-violet-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-violet-800">
              Cargar meta (borrador)
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
