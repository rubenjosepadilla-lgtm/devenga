import { createClient } from '@/lib/supabase/server'
import { AccionesPeriodo } from './AccionesPeriodo'
import { AcuseMovimiento } from './AcuseMovimiento'

export default async function PeriodoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: periodo } = await supabase.from('periodos').select('*, sociedades(nombre, pais)').eq('id', id).single()
  if (!periodo) return <p className="text-gray-400">Período no encontrado.</p>

  const { data: resultados } = await supabase
    .from('resultados_calculo')
    .select('*, comisionados(identificador_personal)')
    .eq('periodo_id', id)
    .order('importe', { ascending: false })

  const idsMovimientos = (resultados ?? []).map((r) => r.id_movimiento).filter(Boolean) as string[]
  const { data: movimientos } = idsMovimientos.length
    ? await supabase.from('movimientos_devengo').select('*').in('id_movimiento', idsMovimientos)
    : { data: [] }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <h1 className="text-2xl font-semibold text-gray-900">{(periodo as any).sociedades?.nombre} — {periodo.periodo}</h1>
          <p className="text-sm text-gray-400">Estado: {periodo.estado}</p>
        </div>
        {periodo.estado === 'cerrado' && (
          <div className="flex gap-2">
            <a href={`/api/periodos/${id}/movimientos`} className="text-sm bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800">Exportar JSON</a>
            <a href={`/api/periodos/${id}/movimientos?formato=csv`} className="text-sm border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50">Exportar CSV</a>
          </div>
        )}
      </div>

      <AccionesPeriodo periodoId={id} estado={periodo.estado} />

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-8">
        <div className="px-4 py-3 border-b border-gray-100 text-sm font-semibold text-gray-900">Resultados de cálculo</div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Comisionado</th>
              <th className="px-4 py-3 font-medium">Concepto</th>
              <th className="px-4 py-3 font-medium">Importe</th>
              <th className="px-4 py-3 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(resultados ?? []).map((r: any) => (
              <tr key={r.id_resultado} className="border-t border-gray-100">
                <td className="px-4 py-3 text-gray-900">{r.comisionados?.identificador_personal ?? r.comisionado_id.slice(0, 8)}</td>
                <td className="px-4 py-3 text-gray-500">{r.concepto_codigo}</td>
                <td className="px-4 py-3 text-gray-500">{r.importe.toLocaleString('es-CL')} {r.moneda}</td>
                <td className="px-4 py-3 text-gray-500">{r.estado}</td>
              </tr>
            ))}
            {(resultados ?? []).length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">Aún no hay resultados — ejecuta el cálculo.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {(movimientos ?? []).length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 text-sm font-semibold text-gray-900">Movimientos de devengo (§3.8)</div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Concepto</th>
                <th className="px-4 py-3 font-medium">Importe</th>
                <th className="px-4 py-3 font-medium">Devengo diario</th>
                <th className="px-4 py-3 font-medium">incide_en</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Acuse (§3.9)</th>
              </tr>
            </thead>
            <tbody>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(movimientos ?? []).map((m: any) => (
                <tr key={m.id_movimiento} className="border-t border-gray-100">
                  <td className="px-4 py-3 text-gray-900">{m.concepto}</td>
                  <td className="px-4 py-3 text-gray-500">{m.importe.toLocaleString('es-CL')} {m.moneda}</td>
                  <td className="px-4 py-3 text-gray-500">{m.devengo_diario ? 'sí' : 'no'}</td>
                  <td className="px-4 py-3 text-gray-500">{(m.incide_en ?? []).join(', ')}</td>
                  <td className="px-4 py-3 text-gray-500">{m.estado}</td>
                  <td className="px-4 py-3"><AcuseMovimiento movimientoId={m.id_movimiento} estado={m.estado} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
