import { createClient } from '@/lib/supabase/server'
import { PAISES_V1 } from '@/lib/dominio/tipos'
import { CATALOGO_CONCEPTOS } from '@/lib/dominio/conceptos'
import { sociedadesDelUsuario } from '@/lib/datos/sociedad-activa'
import { crearPlantilla, crearComponente, aprobarPlantilla, crearAsignacion } from './actions'

export default async function PlanesPage() {
  const supabase = await createClient()
  const sociedades = await sociedadesDelUsuario()

  const { data: plantillas } = await supabase
    .from('plantillas_plan')
    .select('*, componentes_plan(*), asignaciones_plan(*)')
    .order('created_at', { ascending: false })

  const { data: comisionados } = await supabase
    .from('comisionado_sociedad')
    .select('comisionado_id, comisionados(identificador_personal)')

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-8">Planes</h1>

      <div className="space-y-4 mb-8">
        {(plantillas ?? []).map((p) => (
          <div key={p.id} className="bg-white rounded-2xl border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900">{p.nombre}</h3>
                <p className="text-xs text-gray-400">{p.pais} · {p.periodicidad} · v{p.version} · {p.estado}</p>
              </div>
              {p.estado === 'borrador' && (
                <form action={aprobarPlantilla}>
                  <input type="hidden" name="plantilla_id" value={p.id_plantilla} />
                  <button type="submit" className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-800">
                    Aprobar (puerta 1)
                  </button>
                </form>
              )}
            </div>
            <table className="w-full text-sm mb-2">
              <thead className="text-gray-400 text-left">
                <tr>
                  <th className="py-1 font-medium">Orden</th>
                  <th className="py-1 font-medium">Tipo</th>
                  <th className="py-1 font-medium">Concepto</th>
                  <th className="py-1 font-medium">Base</th>
                </tr>
              </thead>
              <tbody>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {(p.componentes_plan ?? []).sort((a: any, b: any) => a.orden_evaluacion - b.orden_evaluacion).map((c: any) => (
                  <tr key={c.id} className="border-t border-gray-50">
                    <td className="py-1 text-gray-500">{c.orden_evaluacion}</td>
                    <td className="py-1 text-gray-900">{c.tipo}</td>
                    <td className="py-1 text-gray-500">{c.concepto_codigo}</td>
                    <td className="py-1 text-gray-500">{c.base_medicion}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <details className="text-sm">
              <summary className="text-violet-700 cursor-pointer">+ agregar componente</summary>
              <form action={crearComponente} className="grid grid-cols-2 gap-3 mt-3">
                <input type="hidden" name="plantilla_id" value={p.id_plantilla} />
                <select name="tipo" required className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option value="tasa_lineal">Tasa lineal</option>
                  <option value="escalonado_marginal">Escalonado marginal</option>
                  <option value="escalonado_total">Escalonado total</option>
                  <option value="multiplicador_por_logro">Multiplicador por logro</option>
                  <option value="monto_fijo_por_hito">Monto fijo por hito</option>
                  <option value="override_jerarquia">Override de jerarquía</option>
                  <option value="pool_equipo">Pool de equipo</option>
                  <option value="campaña">Campaña</option>
                </select>
                <select name="concepto_codigo" required className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  {CATALOGO_CONCEPTOS.filter((c) => c.pais === p.pais).map((c) => (
                    <option key={c.codigo} value={c.codigo}>{c.codigo}</option>
                  ))}
                </select>
                <select name="base_medicion" required className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option value="monto">Monto</option>
                  <option value="unidades">Unidades</option>
                  <option value="margen">Margen</option>
                  <option value="mix">Mix</option>
                </select>
                <input type="number" name="orden_evaluacion" placeholder="Orden" required className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                <input type="number" step="0.0001" name="tasa" placeholder="Tasa (si aplica, ej. 0.03)" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                <select name="regla_reparto" className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option value="">Regla de reparto (solo pool_equipo)</option>
                  <option value="partes_iguales">Partes iguales</option>
                  <option value="ponderado_por_aporte">Ponderado por aporte</option>
                  <option value="ponderado_por_dotacion">Ponderado por dotación</option>
                  <option value="manual_aprobado">Manual aprobado</option>
                </select>
                <button type="submit" className="col-span-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800">
                  Agregar componente
                </button>
              </form>
            </details>

            <div className="mt-3 text-xs text-gray-500">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(p.asignaciones_plan ?? []).length} asignación(es): {(p.asignaciones_plan ?? []).map((a: any) => `${a.destino_tipo}:${a.destino_id.slice(0, 8)}…`).join(', ')}
            </div>
            <details className="text-sm mt-1">
              <summary className="text-violet-700 cursor-pointer">+ asignar a un comisionado</summary>
              <form action={crearAsignacion} className="grid grid-cols-2 gap-3 mt-3">
                <input type="hidden" name="plantilla_id" value={p.id_plantilla} />
                <input type="hidden" name="destino_tipo" value="comisionado" />
                <select name="destino_id" required className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {(comisionados ?? []).map((c: any) => (
                    <option key={c.comisionado_id} value={c.comisionado_id}>{c.comisionados?.identificador_personal}</option>
                  ))}
                </select>
                <input type="date" name="vigencia_desde" required className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                <button type="submit" className="col-span-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800">
                  Asignar
                </button>
              </form>
            </details>
          </div>
        ))}
        {(plantillas ?? []).length === 0 && <p className="text-sm text-gray-400">Aún no hay plantillas de plan.</p>}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6 max-w-xl">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Nueva plantilla</h2>
        {sociedades.length === 0 ? (
          <p className="text-sm text-gray-400">Crea primero una sociedad.</p>
        ) : (
          <form action={crearPlantilla} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Nombre</label>
              <input name="nombre" required className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Sociedad</label>
                <select name="sociedad_id" required className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  {sociedades.map((s) => <option key={s.id_sociedad} value={s.id_sociedad}>{s.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">País</label>
                <select name="pais" required className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  {PAISES_V1.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Periodicidad</label>
                <select name="periodicidad" required className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option value="mensual">Mensual</option>
                  <option value="diaria">Diaria</option>
                  <option value="semanal">Semanal</option>
                  <option value="trimestral">Trimestral</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Moneda</label>
                <input name="moneda" required placeholder="CLP, PEN, COP, MXN, ARS" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Vigente desde</label>
              <input type="date" name="vigencia_desde" required className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <button type="submit" className="bg-violet-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-violet-800">
              Crear plantilla (borrador)
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
