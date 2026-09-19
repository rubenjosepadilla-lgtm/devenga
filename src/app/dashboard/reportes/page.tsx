import { createClient } from '@/lib/supabase/server'
import { sociedadesDelUsuario } from '@/lib/datos/sociedad-activa'
import { ExportarCSV } from './ExportarCSV'

export default async function ReportesPage() {
  const supabase = await createClient()
  const sociedades = await sociedadesDelUsuario()
  const idsSociedad = sociedades.map((s) => s.id_sociedad)

  const [{ data: movimientos }, { data: resultados }] = await Promise.all([
    idsSociedad.length
      ? supabase
          .from('movimientos_devengo')
          .select('id_movimiento, concepto_codigo, periodo_origen, periodo_imputacion, importe_bruto, moneda, estado, principalidad, ordinariedad, created_at')
          .in('sociedad', idsSociedad)
          .order('created_at', { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [] }),
    idsSociedad.length
      ? supabase
          .from('resultados_calculo')
          .select('id_resultado, concepto_codigo, importe, moneda, estado, created_at, periodos(periodo), comisionados(identificador_personal)')
          .in('sociedad_id', idsSociedad)
          .order('created_at', { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [] }),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const movCSV = (movimientos ?? []).map((m: any) => ({
    id: m.id_movimiento,
    concepto: m.concepto_codigo,
    periodo_origen: m.periodo_origen,
    periodo_imputacion: m.periodo_imputacion,
    importe_bruto: m.importe_bruto,
    moneda: m.moneda,
    estado: m.estado,
    principalidad: m.principalidad,
    ordinariedad: m.ordinariedad,
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resCSV = (resultados ?? []).map((r: any) => ({
    id: r.id_resultado,
    comisionado: r.comisionados?.identificador_personal ?? '—',
    periodo: r.periodos?.periodo ?? '—',
    concepto: r.concepto_codigo,
    importe: r.importe,
    moneda: r.moneda,
    estado: r.estado,
  }))

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-8">Reportes</h1>

      {/* Movimientos de devengo */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Movimientos de devengo</h2>
          <ExportarCSV datos={movCSV} nombre="movimientos_devengo" />
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Concepto</th>
                <th className="px-4 py-3 font-medium">Período origen</th>
                <th className="px-4 py-3 font-medium">Período imputación</th>
                <th className="px-4 py-3 font-medium">Importe bruto</th>
                <th className="px-4 py-3 font-medium">Moneda</th>
                <th className="px-4 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(movimientos ?? []).map((m: any) => (
                <tr key={m.id_movimiento} className="border-t border-gray-100">
                  <td className="px-4 py-3 text-gray-900">{m.concepto_codigo}</td>
                  <td className="px-4 py-3 text-gray-500">{m.periodo_origen}</td>
                  <td className="px-4 py-3 text-gray-500">{m.periodo_imputacion}</td>
                  <td className="px-4 py-3 text-gray-500">{Number(m.importe_bruto).toLocaleString('es-CL')}</td>
                  <td className="px-4 py-3 text-gray-500">{m.moneda}</td>
                  <td className="px-4 py-3">
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                      {m.estado}
                    </span>
                  </td>
                </tr>
              ))}
              {(movimientos ?? []).length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Sin movimientos aún.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Resultados de cálculo */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Resultados de cálculo</h2>
          <ExportarCSV datos={resCSV} nombre="resultados_calculo" />
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Comisionado</th>
                <th className="px-4 py-3 font-medium">Período</th>
                <th className="px-4 py-3 font-medium">Concepto</th>
                <th className="px-4 py-3 font-medium">Importe</th>
                <th className="px-4 py-3 font-medium">Moneda</th>
                <th className="px-4 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(resultados ?? []).map((r: any) => (
                <tr key={r.id_resultado} className="border-t border-gray-100">
                  <td className="px-4 py-3 text-gray-900">{r.comisionados?.identificador_personal ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{r.periodos?.periodo ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{r.concepto_codigo}</td>
                  <td className="px-4 py-3 text-gray-500">{Number(r.importe).toLocaleString('es-CL')}</td>
                  <td className="px-4 py-3 text-gray-500">{r.moneda}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${r.estado === 'congelado' ? 'bg-gray-100 text-gray-600' : 'bg-yellow-50 text-yellow-700'}`}>
                      {r.estado}
                    </span>
                  </td>
                </tr>
              ))}
              {(resultados ?? []).length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Sin resultados aún.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
