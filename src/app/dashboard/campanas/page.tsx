import { createClient } from '@/lib/supabase/server'
import { CATALOGO_CONCEPTOS } from '@/lib/dominio/conceptos'
import { sociedadesDelUsuario } from '@/lib/datos/sociedad-activa'
import { crearCampana, autorizarCampana, publicarCampana } from './actions'

export default async function CampanasPage() {
  const supabase = await createClient()
  const sociedades = await sociedadesDelUsuario()

  const { data: campanas } = await supabase.from('campanas').select('*').order('created_at', { ascending: false })

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-8">Campañas</h1>

      <div className="space-y-3 mb-8">
        {(campanas ?? []).map((c) => (
          <div key={c.id_campana} className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">{c.concepto_codigo} · {c.multiplicador ? `x${c.multiplicador}` : `+${c.monto}`}</p>
              <p className="text-xs text-gray-400">
                {c.vigencia_hecho_desde} → {c.vigencia_hecho_hasta} · alcance: {c.alcance_retroactivo} · estado: <strong>{c.estado}</strong>
              </p>
            </div>
            <div className="flex gap-2">
              {c.estado === 'borrador' && (
                <form action={autorizarCampana}>
                  <input type="hidden" name="id_campana" value={c.id_campana} />
                  <input type="hidden" name="nivel_autorizacion" value="jefatura_comercial" />
                  <button type="submit" className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-800">
                    Autorizar (puerta 3)
                  </button>
                </form>
              )}
              {c.estado === 'autorizada' && (
                <form action={publicarCampana}>
                  <input type="hidden" name="id_campana" value={c.id_campana} />
                  <button type="submit" className="text-xs bg-violet-700 text-white px-3 py-1.5 rounded-lg hover:bg-violet-800">
                    Publicar
                  </button>
                </form>
              )}
            </div>
          </div>
        ))}
        {(campanas ?? []).length === 0 && <p className="text-sm text-gray-400">Aún no hay campañas.</p>}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6 max-w-xl">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Nueva campaña</h2>
        {sociedades.length === 0 ? (
          <p className="text-sm text-gray-400">Crea primero una sociedad.</p>
        ) : (
          <form action={crearCampana} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Sociedad</label>
                <select name="sociedad_id" required className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  {sociedades.map((s) => <option key={s.id_sociedad} value={s.id_sociedad}>{s.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Concepto</label>
                <select name="concepto_codigo" required className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  {CATALOGO_CONCEPTOS.map((c) => <option key={c.codigo} value={c.codigo}>{c.codigo}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Condición</label>
              <select name="condicion_tipo" required className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="meta_individual">Meta individual</option>
                <option value="meta_grupal">Meta grupal</option>
                <option value="producto_focalizado">Producto focalizado</option>
                <option value="mixta">Mixta</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Multiplicador (ej. 2)</label>
                <input type="number" step="0.01" name="multiplicador" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Monto fijo (alternativa)</label>
                <input type="number" step="0.01" name="monto" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Vigencia del hecho — desde</label>
                <input type="date" name="vigencia_hecho_desde" required className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Vigencia del hecho — hasta</label>
                <input type="date" name="vigencia_hecho_hasta" required className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Alcance retroactivo</label>
              <select name="alcance_retroactivo" required className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="desde_publicacion">Desde publicación</option>
                <option value="todo_el_periodo_abierto">Todo el período abierto</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">
                &quot;Todo el período abierto&quot; cambia la base de semana corrida (u otro beneficio derivado) del mes completo (§2.8).
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Presupuesto tope</label>
              <input type="number" step="0.01" name="presupuesto_tope" required className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <button type="submit" className="bg-violet-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-violet-800">
              Crear campaña (borrador)
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
