import { createClient } from '@/lib/supabase/server'
import { PAISES_V1 } from '@/lib/dominio/tipos'
import { sociedadesDelUsuario } from '@/lib/datos/sociedad-activa'
import { crearComisionadoConVinculo } from './actions'
import { EliminarBtn } from './EliminarBtn'
import { CopiarLinkPortal } from './CopiarLinkPortal'
import { CargaCSVComisionados } from './CargaCSV'

export default async function ComisionadosPage() {
  const supabase = await createClient()
  const sociedades = await sociedadesDelUsuario()

  const { data: vinculos } = await supabase
    .from('comisionado_sociedad')
    .select('id_en_nomina, centro_costo, rol_comercial, desde, comisionados(id_comisionado, pais, identificador_personal, tipo, usuario_id), sociedades(nombre)')
    .order('desde', { ascending: false })

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-8">Comisionados</h1>

      <div className="bg-violet-50 border border-violet-100 rounded-2xl px-5 py-4 mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-violet-900">Link de registro para comisionados</p>
          <p className="text-xs text-violet-600 mt-0.5">Comparte esta URL con cada comisionado para que cree su cuenta en el portal.</p>
        </div>
        <CopiarLinkPortal />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-8">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Identificador</th>
              <th className="px-4 py-3 font-medium">País</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Sociedad</th>
              <th className="px-4 py-3 font-medium">ID en nómina</th>
              <th className="px-4 py-3 font-medium">Rol comercial</th>
              <th className="px-4 py-3 font-medium">Acceso portal</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(vinculos ?? []).map((v: any, idx: number) => (
              <tr key={idx} className="border-t border-gray-100">
                <td className="px-4 py-3 text-gray-900">{v.comisionados?.identificador_personal}</td>
                <td className="px-4 py-3 text-gray-500">{v.comisionados?.pais}</td>
                <td className="px-4 py-3 text-gray-500">{v.comisionados?.tipo}</td>
                <td className="px-4 py-3 text-gray-500">{v.sociedades?.nombre}</td>
                <td className="px-4 py-3 text-gray-500">{v.id_en_nomina}</td>
                <td className="px-4 py-3 text-gray-500">{v.rol_comercial ?? '—'}</td>
                <td className="px-4 py-3">
                  {v.comisionados?.usuario_id
                    ? <span className="text-xs text-green-600 font-medium">✓ Vinculado</span>
                    : <span className="text-xs text-gray-400">Sin cuenta</span>}
                </td>
                <td className="px-4 py-3">
                  {v.comisionados?.id_comisionado && (
                    <EliminarBtn comisionadoId={v.comisionados.id_comisionado} />
                  )}
                </td>
              </tr>
            ))}
            {(vinculos ?? []).length === 0 && (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-gray-400">Aún no hay comisionados.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6 max-w-xl">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Nuevo comisionado</h2>
        {sociedades.length === 0 ? (
          <p className="text-sm text-gray-400">Crea primero una sociedad.</p>
        ) : (
          <form action={crearComisionadoConVinculo} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">País</label>
                <select name="pais" required className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  {PAISES_V1.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Identificador personal</label>
                <input name="identificador_personal" required placeholder="Cédula / RUT / DNI / CURP / CUIL" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Tipo</label>
                <select name="tipo" required className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option value="dependiente">Dependiente</option>
                  <option value="no_dependiente">No dependiente (honorarios/agente)</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Vigente desde</label>
                <input type="date" name="vigencia_desde" required className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Sociedad</label>
              <select name="sociedad_id" required className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                {sociedades.map((s) => <option key={s.id_sociedad} value={s.id_sociedad}>{s.nombre} ({s.pais})</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">ID en nómina</label>
                <input name="id_en_nomina" required className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Rol comercial</label>
                <input name="rol_comercial" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Centro de costo</label>
              <input name="centro_costo" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Email del comisionado</label>
              <input type="email" name="email" placeholder="vendedor@empresa.com" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              <p className="text-xs text-gray-400 mt-1">Se enviará una invitación para que establezca su contraseña y acceda al portal.</p>
            </div>
            <button type="submit" className="bg-violet-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-violet-800">
              Crear comisionado y enviar invitación
            </button>
          </form>
        )}
      </div>

      {sociedades.length > 0 && (
        <div className="max-w-2xl">
          <CargaCSVComisionados sociedad_id={sociedades[0].id_sociedad} />
        </div>
      )}
    </div>
  )
}
