import { createClient } from '@/lib/supabase/server'
import { PAISES_V1 } from '@/lib/dominio/tipos'
import { crearSociedad } from './actions'

export default async function SociedadesPage() {
  const supabase = await createClient()
  const { data: sociedades } = await supabase.from('sociedades').select('*').order('created_at', { ascending: false })

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-8">Sociedades</h1>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-8">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">País</th>
              <th className="px-4 py-3 font-medium">Sistema de nómina</th>
              <th className="px-4 py-3 font-medium">Modo</th>
              <th className="px-4 py-3 font-medium">Corte</th>
            </tr>
          </thead>
          <tbody>
            {(sociedades ?? []).map((s) => (
              <tr key={s.id_sociedad} className="border-t border-gray-100">
                <td className="px-4 py-3 text-gray-900">{s.nombre}</td>
                <td className="px-4 py-3 text-gray-500">{s.pais}</td>
                <td className="px-4 py-3 text-gray-500">{s.sistema_nomina}</td>
                <td className="px-4 py-3 text-gray-500">{s.modo_integracion}</td>
                <td className="px-4 py-3 text-gray-500">día {s.dia_corte_comisiones}</td>
              </tr>
            ))}
            {(sociedades ?? []).length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Aún no hay sociedades.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6 max-w-xl">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Nueva sociedad</h2>
        <form action={crearSociedad} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Nombre</label>
            <input name="nombre" required className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700">País</label>
              <select name="pais" required className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                {PAISES_V1.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Identificador fiscal</label>
              <input name="identificador_fiscal" required placeholder="RUT / RUC / NIT / RFC / CUIT" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Sistema de nómina</label>
              <select name="sistema_nomina" required className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="suel2">Suel2</option>
                <option value="sap">SAP HCM</option>
                <option value="otro">Otro</option>
                <option value="excel">Excel</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Modo de integración</label>
              <select name="modo_integracion" required className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="api">API</option>
                <option value="archivo">Archivo</option>
                <option value="manual">Manual</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Calendario de períodos</label>
              <select name="calendario_periodos" required className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="mensual">Mensual</option>
                <option value="quincenal">Quincenal</option>
                <option value="semanal">Semanal</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Día de corte</label>
              <input type="number" name="dia_corte_comisiones" min={1} max={28} required className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Responsable de aprobación (rol, no persona)</label>
            <input name="responsable_aprobacion" required placeholder="p. ej. Jefatura Comercial" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <button type="submit" className="bg-violet-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-violet-800">
            Crear sociedad
          </button>
        </form>
      </div>
    </div>
  )
}
