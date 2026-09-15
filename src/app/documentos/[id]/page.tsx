import { createClient } from '@/lib/supabase/server'
import { estadoPortalDe, ETIQUETA_ESTADO_PORTAL } from '@/lib/dominio/fase3/estado-portal'

/**
 * §3.7 — documento de detalle de comisiones: conceptos, importes, operaciones
 * que los originaron, método de cálculo aplicado, metas y logros, campañas
 * vigentes, y desagregación diaria cuando aplica. En Chile es el insumo del
 * anexo obligatorio a la liquidación (§3.7) — aquí sigue siendo la misma
 * página para los cinco países; el anexo formal específico de Chile no está
 * generado todavía (riesgo #4, §9).
 */
export default async function DocumentoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: resultado } = await supabase
    .from('resultados_calculo')
    .select('*, comisionados(identificador_personal, pais), movimientos_devengo(*)')
    .eq('id_resultado', id)
    .maybeSingle()

  if (!resultado) {
    return <main className="max-w-2xl mx-auto p-8 text-center text-gray-400">Documento no encontrado o sin acceso.</main>
  }

  const { data: concepto } = await supabase.from('conceptos').select('*').eq('codigo', resultado.concepto_codigo).single()
  const estado = estadoPortalDe(resultado, resultado.movimientos_devengo)
  const snapshot = resultado.snapshot as { creditos?: { id_credito: string; monto: number }[] } | null

  return (
    <main className="max-w-2xl mx-auto p-8">
      <div className="bg-white rounded-2xl border border-gray-100 p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Detalle de comisión</h1>
          <span className="text-xs bg-violet-50 text-violet-700 px-3 py-1 rounded-full">{ETIQUETA_ESTADO_PORTAL[estado]}</span>
        </div>

        <dl className="grid grid-cols-2 gap-4 text-sm mb-6">
          <div><dt className="text-gray-400">Comisionado</dt><dd className="text-gray-900">{resultado.comisionados?.identificador_personal}</dd></div>
          <div><dt className="text-gray-400">Concepto</dt><dd className="text-gray-900">{resultado.concepto_codigo} — {concepto?.nombre}</dd></div>
          <div><dt className="text-gray-400">Importe</dt><dd className="text-gray-900">{resultado.importe.toLocaleString('es-CL')} {resultado.moneda}</dd></div>
          <div><dt className="text-gray-400">Método de cálculo</dt><dd className="text-gray-900">{concepto?.base_devengo} · evento: {concepto?.evento_devengo}</dd></div>
          <div><dt className="text-gray-400">Remunerativo</dt><dd className="text-gray-900">{concepto?.remunerativo ? 'Sí' : 'No'}</dd></div>
          <div><dt className="text-gray-400">Incide en</dt><dd className="text-gray-900">{(concepto?.incide_en ?? []).join(', ')}</dd></div>
        </dl>

        {resultado.detalle_diario && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-2">Desagregación diaria (§0.3)</h2>
            <table className="w-full text-sm">
              <tbody>
                {(resultado.detalle_diario as { fecha: string; importe: number }[]).map((d) => (
                  <tr key={d.fecha} className="border-t border-gray-50">
                    <td className="py-1 text-gray-500">{d.fecha}</td>
                    <td className="py-1 text-gray-900 text-right">{d.importe.toLocaleString('es-CL')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {snapshot?.creditos && snapshot.creditos.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-2">Operaciones que originaron este importe</h2>
            <table className="w-full text-sm">
              <tbody>
                {snapshot.creditos.map((c) => (
                  <tr key={c.id_credito} className="border-t border-gray-50">
                    <td className="py-1 text-gray-500 font-mono text-xs">{c.id_credito.slice(0, 8)}…</td>
                    <td className="py-1 text-gray-900 text-right">{c.monto.toLocaleString('es-CL')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-gray-400">
          Documento reproducible: expediente hash {resultado.movimientos_devengo?.hash_detalle?.slice(0, 16) ?? '(sin movimiento generado aún)'}
        </p>
      </div>
    </main>
  )
}
