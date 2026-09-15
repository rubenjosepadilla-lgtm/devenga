import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { estadoPortalDe, ETIQUETA_ESTADO_PORTAL } from '@/lib/dominio/fase3/estado-portal'

export default async function PortalHome() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: comisionado } = await supabase.from('comisionados').select('id_comisionado').eq('usuario_id', user!.id).single()
  const comisionadoId = comisionado!.id_comisionado

  const [{ data: metas }, { data: campanas }, { data: resultados }, { data: creditos }] = await Promise.all([
    supabase.from('metas').select('*').eq('destino_tipo', 'comisionado').eq('destino_id', comisionadoId).eq('estado', 'vigente'),
    supabase.from('campanas').select('*').eq('estado', 'publicada').order('vigencia_hecho_desde', { ascending: false }),
    supabase
      .from('resultados_calculo')
      .select('*, movimientos_devengo(estado)')
      .eq('comisionado_id', comisionadoId)
      .order('created_at', { ascending: false })
      .limit(30),
    supabase.from('creditos').select('*, transacciones(producto, canal, tipo_evento)').eq('comisionado_id', comisionadoId).order('fecha_credito', { ascending: false }).limit(15),
  ])

  const avancePorMeta = new Map<string, number>()
  for (const m of metas ?? []) {
    const total = (creditos ?? []).filter((c) => c.fecha_credito.slice(0, 7) === m.periodo).reduce((acc, c) => acc + c.monto_atribuido, 0)
    avancePorMeta.set(m.id_meta, total)
  }

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-xl font-semibold text-gray-900 mb-4">Mis metas</h1>
        <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100">
          {(metas ?? []).map((m) => {
            const avance = avancePorMeta.get(m.id_meta) ?? 0
            const pct = m.magnitud > 0 ? Math.min(100, (avance / m.magnitud) * 100) : 0
            return (
              <div key={m.id_meta} className="p-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-900">{m.periodo}</span>
                  <span className="text-gray-500">{avance.toLocaleString('es-CL')} / {m.magnitud.toLocaleString('es-CL')} {m.unidad}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-violet-600" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
          {(metas ?? []).length === 0 && <p className="p-4 text-sm text-gray-400">Sin metas vigentes.</p>}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Campañas vigentes</h2>
        <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100">
          {(campanas ?? []).map((c) => (
            <div key={c.id_campana} className="p-4 text-sm">
              <p className="text-gray-900">{c.concepto_codigo} · {c.multiplicador ? `x${c.multiplicador}` : `+${c.monto}`}</p>
              <p className="text-gray-400 text-xs">{c.vigencia_hecho_desde} → {c.vigencia_hecho_hasta}</p>
            </div>
          ))}
          {(campanas ?? []).length === 0 && <p className="p-4 text-sm text-gray-400">Sin campañas publicadas.</p>}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Historial de comisiones</h2>
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Concepto</th>
                <th className="px-4 py-3 font-medium">Importe</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(resultados ?? []).map((r: any) => {
                const estado = estadoPortalDe(r, r.movimientos_devengo)
                return (
                  <tr key={r.id_resultado} className="border-t border-gray-100">
                    <td className="px-4 py-3 text-gray-900">{r.concepto_codigo}</td>
                    <td className="px-4 py-3 text-gray-500">{r.importe.toLocaleString('es-CL')} {r.moneda}</td>
                    <td className="px-4 py-3 text-gray-500">{ETIQUETA_ESTADO_PORTAL[estado]}</td>
                    <td className="px-4 py-3">
                      <Link href={`/documentos/${r.id_resultado}`} className="text-violet-700 hover:underline text-xs">Ver detalle</Link>
                    </td>
                  </tr>
                )
              })}
              {(resultados ?? []).length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">Aún no hay comisiones calculadas.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          &quot;Estimado provisional&quot; no constituye devengo — es una proyección con la información disponible al corte, no un compromiso de pago.
        </p>
      </section>
    </div>
  )
}
