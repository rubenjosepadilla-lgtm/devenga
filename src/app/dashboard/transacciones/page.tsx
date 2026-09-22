import { createClient } from '@/lib/supabase/server'
import { sociedadesDelUsuario } from '@/lib/datos/sociedad-activa'
import { IngestaForm } from './IngestaForm'
import { crearFuente, resolverCuarentena } from './actions'
import { CargaCSVTransacciones } from './CargaCSV'

export default async function TransaccionesPage() {
  const supabase = await createClient()
  const sociedades = await sociedadesDelUsuario()
  const idsSociedad = sociedades.map((s) => s.id_sociedad)

  const [{ data: fuentes }, { data: comisionados }, { data: transacciones }, { data: cuarentena }] = await Promise.all([
    idsSociedad.length ? supabase.from('fuentes').select('id_fuente, sistema').in('sociedad_id', idsSociedad) : Promise.resolve({ data: [] }),
    idsSociedad.length
      ? supabase.from('comisionado_sociedad').select('comisionado_id, comisionados(identificador_personal)').in('sociedad_id', idsSociedad)
      : Promise.resolve({ data: [] }),
    idsSociedad.length ? supabase.from('transacciones').select('*').in('sociedad_id', idsSociedad).order('created_at', { ascending: false }).limit(20) : Promise.resolve({ data: [] }),
    idsSociedad.length
      ? supabase.from('transacciones_cuarentena').select('*, fuentes!inner(sociedad_id, sistema)').eq('resuelto', false).in('fuentes.sociedad_id', idsSociedad)
      : Promise.resolve({ data: [] }),
  ])

  const comisionadosPlanos = (comisionados ?? []).map((c) => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    comisionado_id: c.comisionado_id, identificador_personal: (c as any).comisionados?.identificador_personal ?? c.comisionado_id,
  }))

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-8">Transacciones</h1>

      {(cuarentena ?? []).length > 0 && (
        <div className="bg-orange-50 border border-orange-100 rounded-2xl p-6 mb-8">
          <h2 className="text-sm font-semibold text-orange-900 mb-3">En cuarentena — §3.1</h2>
          <div className="space-y-2">
            {(cuarentena ?? []).map((c) => (
              <div key={c.id} className="flex items-center justify-between text-sm bg-white rounded-lg px-4 py-3">
                <span className="text-gray-700">{c.motivo}</span>
                <form action={resolverCuarentena}>
                  <input type="hidden" name="id" value={c.id} />
                  <button type="submit" className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-800">Marcar resuelto</button>
                </form>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-8">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Monto</th>
              <th className="px-4 py-3 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {(transacciones ?? []).map((t) => (
              <tr key={t.id_transaccion} className="border-t border-gray-100">
                <td className="px-4 py-3 text-gray-900">{t.fecha_hecho}</td>
                <td className="px-4 py-3 text-gray-500">{t.tipo_evento}</td>
                <td className="px-4 py-3 text-gray-500">{(t.monto_bruto ?? 0).toLocaleString('es-CL')} {t.moneda}</td>
                <td className="px-4 py-3 text-gray-500">{t.estado}</td>
              </tr>
            ))}
            {(transacciones ?? []).length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">Aún no hay transacciones.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {sociedades.length === 0 ? (
        <p className="text-sm text-gray-400">Crea primero una sociedad.</p>
      ) : (fuentes ?? []).length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 max-w-lg">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Registra una fuente antes de ingestar (§2.9)</h2>
          <form action={crearFuente} className="space-y-4">
            <select name="sociedad_id" required className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
              {sociedades.map((s) => <option key={s.id_sociedad} value={s.id_sociedad}>{s.nombre}</option>)}
            </select>
            <input name="sistema" required placeholder="CRM, ERP, POS..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            <select name="modo" required className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
              <option value="api">API</option>
              <option value="archivo">Archivo</option>
              <option value="manual">Manual</option>
            </select>
            <select name="politica_duplicados" required className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
              <option value="rechazar">Rechazar duplicados</option>
              <option value="actualizar">Actualizar duplicados</option>
              <option value="versionar">Versionar duplicados</option>
            </select>
            <input type="number" name="ventana_aceptacion_dias" placeholder="Ventana de aceptación (días), default 90" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            <button type="submit" className="bg-violet-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-violet-800">Crear fuente</button>
          </form>
        </div>
      ) : comisionadosPlanos.length === 0 ? (
        <p className="text-sm text-gray-400">Crea primero al menos un comisionado.</p>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 max-w-xl">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Ingestar transacción</h2>
          <IngestaForm sociedades={sociedades} fuentes={fuentes ?? []} comisionados={comisionadosPlanos} />
        </div>
      )}

      {sociedades.length > 0 && (fuentes ?? []).length > 0 && (
        <div className="max-w-2xl">
          <CargaCSVTransacciones
            sociedad_id={sociedades[0].id_sociedad}
            fuente_id={(fuentes ?? [])[0]?.id_fuente ?? ''}
          />
        </div>
      )}
    </div>
  )
}
