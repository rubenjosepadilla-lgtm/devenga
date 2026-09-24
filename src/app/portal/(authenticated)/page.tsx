import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { AlertCircle, CheckCircle2, Clock } from 'lucide-react'

const ESTADO_PERIODO: Record<string, { label: string; clase: string }> = {
  abierto:              { label: 'Estimado provisional', clase: 'bg-yellow-50 text-yellow-700' },
  en_calculo:           { label: 'En cálculo', clase: 'bg-blue-50 text-blue-700' },
  calculado:            { label: 'Calculado — en revisión', clase: 'bg-blue-50 text-blue-700' },
  revision_jefe:        { label: 'En revisión jefe', clase: 'bg-indigo-50 text-indigo-700' },
  aprobacion_gerencia:  { label: 'En aprobación gerencia', clase: 'bg-indigo-50 text-indigo-700' },
  aprobado:             { label: 'Aprobado', clase: 'bg-green-50 text-green-700' },
  enviado_nomina:       { label: 'Enviado a nómina', clase: 'bg-green-50 text-green-700' },
  cerrado:              { label: 'Cerrado', clase: 'bg-gray-100 text-gray-600' },
}

export default async function PortalHome() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: comisionado } = await supabase
    .from('comisionados')
    .select('id_comisionado, identificador_personal, pais, tenant_id')
    .eq('usuario_id', user!.id)
    .single()

  if (!comisionado) return null
  const comisionadoId = comisionado.id_comisionado

  const [
    { data: acuses },
    { data: metas },
    { data: campanas },
    { data: resultados },
  ] = await Promise.all([
    // Planes pendientes de aceptar (§2.B)
    supabase.rpc('obtener_mis_acuses_plan'),
    supabase.from('metas')
      .select('*')
      .eq('destino_tipo', 'comisionado')
      .eq('destino_id', comisionadoId)
      .eq('estado', 'vigente'),
    supabase.from('campanas')
      .select('*')
      .eq('estado', 'publicada')
      .order('vigencia_hecho_desde', { ascending: false })
      .limit(5),
    supabase.rpc('obtener_mis_resultados', { p_limite: 40 }),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const acusesPlan = (acuses as any[] | null) ?? []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const misResultados = (resultados as any[] | null) ?? []
  const pendientes = acusesPlan.filter((a) => a.estado === 'pendiente')

  // Calcular avance por meta a partir de los resultados del período activo
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const avancePorMeta = new Map<string, number>()
  for (const m of (metas ?? [])) {
    const total = misResultados
      .filter((r) => r.periodo === m.periodo)
      .reduce((acc: number, r: { importe?: number }) => acc + (r.importe ?? 0), 0)
    avancePorMeta.set(m.id_meta, total)
  }

  // Agrupar resultados por período
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const porPeriodo = new Map<string, any[]>()
  for (const r of misResultados) {
    const key = r.periodo ?? '—'
    if (!porPeriodo.has(key)) porPeriodo.set(key, [])
    porPeriodo.get(key)!.push(r)
  }
  const periodos = Array.from(porPeriodo.entries()).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12)

  return (
    <div className="space-y-8">

      {/* Banner planes pendientes (§2.B) */}
      {pendientes.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-4">
          <AlertCircle className="text-amber-600 mt-0.5 shrink-0" size={20} />
          <div>
            <p className="text-sm font-semibold text-amber-900">
              {pendientes.length === 1
                ? 'Tienes 1 plan pendiente de aceptar'
                : `Tienes ${pendientes.length} planes pendientes de aceptar`}
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              Debes revisar y aceptar tu esquema de comisiones para que el período pueda cerrarse.
            </p>
            <Link href="/portal/planes" className="text-xs font-medium text-amber-800 underline mt-2 inline-block">
              Ver planes →
            </Link>
          </div>
        </div>
      )}

      {/* Metas y avance */}
      <section>
        <h1 className="text-xl font-semibold text-gray-900 mb-4">Mis metas</h1>
        <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100">
          {(metas ?? []).map((m) => {
            const avance = avancePorMeta.get(m.id_meta) ?? 0
            const pct = m.magnitud > 0 ? Math.min(100, (avance / m.magnitud) * 100) : 0
            const color = pct >= 100 ? 'bg-green-500' : pct >= 75 ? 'bg-violet-500' : pct >= 50 ? 'bg-blue-500' : 'bg-gray-300'
            return (
              <div key={m.id_meta} className="p-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-900 font-medium">{m.periodo} — {m.concepto_codigo}</span>
                  <span className="text-gray-500">
                    {avance.toLocaleString('es-CL')} / {m.magnitud.toLocaleString('es-CL')} {m.unidad}
                    <span className="ml-2 font-semibold">{pct.toFixed(0)}%</span>
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
                </div>
                <div className="flex justify-end gap-4 mt-1 text-xs text-gray-400">
                  <span className={pct >= 50 ? 'text-violet-600' : ''}>50%</span>
                  <span className={pct >= 75 ? 'text-violet-600' : ''}>75%</span>
                  <span className={pct >= 100 ? 'text-green-600' : ''}>100%</span>
                </div>
              </div>
            )
          })}
          {(metas ?? []).length === 0 && <p className="p-4 text-sm text-gray-400">Sin metas vigentes.</p>}
        </div>
      </section>

      {/* Historial de comisiones por período */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Mis comisiones</h2>
          <Link href="/portal/historial" className="text-sm text-violet-700 hover:underline">Ver historial completo →</Link>
        </div>

        {periodos.map(([periodo, items]) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const estadoPeriodo = items[0]?.estado_periodo ?? 'abierto'
          const info = ESTADO_PERIODO[estadoPeriodo] ?? ESTADO_PERIODO.abierto
          const total = items.reduce((acc: number, r: { importe?: number }) => acc + (r.importe ?? 0), 0)
          return (
            <div key={periodo} className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-4">
              <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-gray-900 text-sm">{periodo}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${info.clase}`}>
                    {info.label}
                  </span>
                </div>
                <span className="text-sm font-semibold text-gray-900">
                  {total.toLocaleString('es-CL')} CLP
                </span>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {items.map((r: any) => (
                    <tr key={r.id_resultado} className="border-t border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-gray-900">{r.concepto_codigo}</td>
                      <td className="px-4 py-2.5 text-gray-500 text-right">
                        {Number(r.importe).toLocaleString('es-CL')} {r.moneda}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Link
                          href={`/documentos/${r.id_resultado}`}
                          className="text-xs text-violet-700 hover:underline"
                        >
                          Ver trazabilidad →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {estadoPeriodo === 'abierto' && (
                <p className="px-4 py-2 text-xs text-amber-600 border-t border-gray-50">
                  Estimado provisional — no constituye devengo. Sujeto a validación al cierre del período.
                </p>
              )}
            </div>
          )
        })}
        {periodos.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400 text-sm">
            Aún no hay comisiones calculadas.
          </div>
        )}
      </section>

      {/* Campañas vigentes */}
      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Campañas vigentes</h2>
        <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100">
          {(campanas ?? []).map((c) => (
            <div key={c.id_campana} className="p-4 text-sm flex items-center justify-between">
              <div>
                <p className="text-gray-900 font-medium">{c.nombre}</p>
                <p className="text-gray-400 text-xs">{c.vigencia_hecho_desde} → {c.vigencia_hecho_hasta}</p>
              </div>
              <div className="text-right">
                <span className="bg-violet-50 text-violet-700 px-2 py-0.5 rounded-full text-xs font-medium">
                  {c.tipo === 'multiplicador' ? `×${c.multiplicador}` : `+${c.monto?.toLocaleString('es-CL')}`}
                </span>
              </div>
            </div>
          ))}
          {(campanas ?? []).length === 0 && <p className="p-4 text-sm text-gray-400">Sin campañas publicadas.</p>}
        </div>
      </section>

      {/* Accesos rápidos */}
      <div className="grid grid-cols-2 gap-4">
        <Link href="/portal/planes" className="bg-white rounded-2xl border border-gray-100 p-5 hover:border-violet-200 hover:shadow-sm transition-all">
          <div className="flex items-center gap-3 mb-1">
            {pendientes.length > 0
              ? <AlertCircle size={18} className="text-amber-500" />
              : <CheckCircle2 size={18} className="text-green-500" />}
            <span className="font-medium text-gray-900 text-sm">Mi plan</span>
          </div>
          <p className="text-xs text-gray-500">
            {pendientes.length > 0
              ? `${pendientes.length} pendiente(s) de aceptar`
              : 'Ver planes asignados y aceptados'}
          </p>
        </Link>
        <Link href="/portal/disputas" className="bg-white rounded-2xl border border-gray-100 p-5 hover:border-violet-200 hover:shadow-sm transition-all">
          <div className="flex items-center gap-3 mb-1">
            <Clock size={18} className="text-gray-400" />
            <span className="font-medium text-gray-900 text-sm">Mis disputas</span>
          </div>
          <p className="text-xs text-gray-500">Ver disputas activas o abrir una nueva</p>
        </Link>
      </div>

    </div>
  )
}
