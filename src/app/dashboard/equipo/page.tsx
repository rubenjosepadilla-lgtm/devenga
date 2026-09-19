import { createClient } from '@/lib/supabase/server'
import { tenantDelUsuario } from '@/lib/datos/tenant'
import { cambiarRol, toggleActivo } from './actions'

export default async function EquipoPage() {
  const supabase = await createClient()
  const ctx = await tenantDelUsuario()
  if (!ctx) return <p className="text-sm text-gray-400">Sin workspace activo.</p>

  // Leer miembros del tenant con su perfil
  const { data: miembros } = await supabase
    .from('usuario_tenant')
    .select('usuario_id, rol_base, activo, created_at')
    .eq('tenant_id', ctx.tenant.id_tenant)
    .order('created_at', { ascending: true })

  // Leer emails de usuarios_app para los IDs encontrados
  const ids = (miembros ?? []).map((m) => m.usuario_id)
  const { data: perfiles } = ids.length
    ? await supabase.from('usuarios_app').select('id, nombre, email').in('id', ids)
    : Promise.resolve({ data: [] })

  const perfilMap = Object.fromEntries((perfiles ?? []).map((p) => [p.id, p]))

  const esAdmin = ctx.rol_base === 'administrador'

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-8">Equipo</h1>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Rol</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              {esAdmin && <th className="px-4 py-3 font-medium">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {(miembros ?? []).map((m) => {
              const perfil = perfilMap[m.usuario_id]
              return (
                <tr key={m.usuario_id} className="border-t border-gray-100">
                  <td className="px-4 py-3 text-gray-900">{perfil?.nombre ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{perfil?.email ?? m.usuario_id}</td>
                  <td className="px-4 py-3 text-gray-500 capitalize">{m.rol_base}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${m.activo ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {m.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  {esAdmin && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <form action={cambiarRol} className="flex items-center gap-2">
                          <input type="hidden" name="usuario_id" value={m.usuario_id} />
                          <select name="rol_base" defaultValue={m.rol_base}
                            className="border border-gray-200 rounded-lg px-2 py-1 text-xs">
                            <option value="administrador">Administrador</option>
                            <option value="jefe">Jefe</option>
                            <option value="comisionado">Comisionado</option>
                          </select>
                          <button type="submit"
                            className="text-xs bg-violet-700 text-white px-2 py-1 rounded-lg hover:bg-violet-800">
                            Guardar
                          </button>
                        </form>
                        <form action={toggleActivo}>
                          <input type="hidden" name="usuario_id" value={m.usuario_id} />
                          <input type="hidden" name="activo" value={String(m.activo)} />
                          <button type="submit"
                            className="text-xs border border-gray-200 px-2 py-1 rounded-lg hover:bg-gray-50 text-gray-600">
                            {m.activo ? 'Desactivar' : 'Activar'}
                          </button>
                        </form>
                      </div>
                    </td>
                  )}
                </tr>
              )
            })}
            {(miembros ?? []).length === 0 && (
              <tr>
                <td colSpan={esAdmin ? 5 : 4} className="px-4 py-6 text-center text-gray-400">
                  No hay miembros en el equipo aún.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
