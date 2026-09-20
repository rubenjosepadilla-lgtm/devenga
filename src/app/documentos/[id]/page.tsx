import { createClient } from '@/lib/supabase/server'
import { estadoPortalDe, ETIQUETA_ESTADO_PORTAL } from '@/lib/dominio/fase3/estado-portal'

/**
 * §3.7 — Documento de detalle de comisiones con trazabilidad por transacción.
 * El comisionado ve exactamente qué operación generó qué comisión y qué regla aplicó.
 * En Chile es el insumo del anexo obligatorio al art. 54 bis (§3.7).
 */
export default async function DocumentoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  // Obtener el resultado y su trazabilidad via RPC (SECURITY DEFINER — valida que pertenece al usuario)
  const { data: trazData } = await supabase.rpc('obtener_trazabilidad_resultado', {
    p_resultado_id: id,
  })

  // Fallback: intentar leer directamente si es staff del tenant
  const { data: resultado } = await supabase
    .from('resultados_calculo')
    .select('*, comisionados(identificador_personal, pais), movimientos_devengo(*), periodos(periodo, estado)')
    .eq('id_resultado', id)
    .maybeSingle()

  if (!resultado) {
    return <main className="max-w-2xl mx-auto p-8 text-center text-gray-400">Documento no encontrado o sin acceso.</main>
  }

  const { data: concepto } = await supabase
    .from('conceptos')
    .select('*')
    .eq('codigo', resultado.concepto_codigo)
    .maybeSingle()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mv = resultado.movimientos_devengo as any
  const estado = estadoPortalDe(resultado, mv)

  // Trazabilidad: transacciones que contribuyeron (de la RPC o vacío)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const trazabilidad: any[] = trazData?.trazabilidad ?? []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const periodoInfo = (resultado as any).periodos

  return (
    <main className="max-w-2xl mx-auto p-8">
      <div className="bg-white rounded-2xl border border-gray-100 p-8 space-y-6">

        {/* Encabezado */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Detalle de comisión</h1>
            {periodoInfo && (
              <p className="text-sm text-gray-400 mt-0.5">Período {periodoInfo.periodo}</p>
            )}
          </div>
          <span className="text-xs bg-violet-50 text-violet-700 px-3 py-1 rounded-full font-medium">
            {ETIQUETA_ESTADO_PORTAL[estado]}
          </span>
        </div>

        {/* Datos generales */}
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-gray-400 text-xs mb-0.5">Comisionado</dt>
            <dd className="text-gray-900">{resultado.comisionados?.identificador_personal}</dd>
          </div>
          <div>
            <dt className="text-gray-400 text-xs mb-0.5">Concepto</dt>
            <dd className="text-gray-900">{resultado.concepto_codigo}{concepto?.nombre ? ` — ${concepto.nombre}` : ''}</dd>
          </div>
          <div>
            <dt className="text-gray-400 text-xs mb-0.5">Importe</dt>
            <dd className="text-gray-900 font-semibold text-lg">{Number(resultado.importe).toLocaleString('es-CL')} {resultado.moneda}</dd>
          </div>
          <div>
            <dt className="text-gray-400 text-xs mb-0.5">Principalidad / Ordinariedad</dt>
            <dd className="text-gray-900 capitalize">{concepto?.principalidad ?? '—'} / {concepto?.ordinariedad ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-gray-400 text-xs mb-0.5">Devengo diario</dt>
            <dd className="text-gray-900">{concepto?.devengo_diario ? 'Sí' : 'No'}</dd>
          </div>
          <div>
            <dt className="text-gray-400 text-xs mb-0.5">Incide en</dt>
            <dd className="text-gray-900">{(concepto?.incide_en ?? []).join(', ') || '—'}</dd>
          </div>
        </dl>

        {/* Desagregación diaria */}
        {resultado.detalle_diario && (
          <div>
            <h2 className="text-sm font-semibold text-gray-900 mb-2">
              Desagregación diaria
              <span className="ml-2 text-xs text-gray-400 font-normal">(requerida para semana corrida / SBC)</span>
            </h2>
            <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-100">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-400 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Fecha</th>
                    <th className="px-3 py-2 text-right font-medium">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {(resultado.detalle_diario as any[]).map((d) => (
                    <tr key={d.fecha ?? d.dia} className="border-t border-gray-50">
                      <td className="px-3 py-1.5 text-gray-500">{d.fecha ?? d.dia}</td>
                      <td className="px-3 py-1.5 text-gray-900 text-right">{Number(d.monto).toLocaleString('es-CL')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Trazabilidad por transacción — diferenciador central (§5.1) */}
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-2">
            Transacciones que generaron esta comisión
            <span className="ml-2 text-xs text-gray-400 font-normal">({trazabilidad.length} operaciones)</span>
          </h2>
          {trazabilidad.length === 0 ? (
            <p className="text-sm text-gray-400">
              Las transacciones detalladas aparecen aquí una vez que el motor de cálculo haya procesado los créditos del período.
            </p>
          ) : (
            <div className="rounded-lg border border-gray-100 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-400">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Fecha</th>
                    <th className="px-3 py-2 text-left font-medium">Evento</th>
                    <th className="px-3 py-2 text-left font-medium">Producto</th>
                    <th className="px-3 py-2 text-right font-medium">Monto transacción</th>
                    <th className="px-3 py-2 text-right font-medium">Comisión atribuida</th>
                    <th className="px-3 py-2 text-right font-medium">% atribuido</th>
                  </tr>
                </thead>
                <tbody>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {trazabilidad.map((t: any) => (
                    <tr key={t.id_credito} className="border-t border-gray-50 hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-500">{t.fecha_hecho}</td>
                      <td className="px-3 py-2 text-gray-700">{t.tipo_evento}</td>
                      <td className="px-3 py-2 text-gray-500">{t.producto ?? '—'}</td>
                      <td className="px-3 py-2 text-gray-700 text-right">{Number(t.monto_transaccion).toLocaleString('es-CL')}</td>
                      <td className="px-3 py-2 text-violet-700 font-medium text-right">{Number(t.monto_atribuido).toLocaleString('es-CL')}</td>
                      <td className="px-3 py-2 text-gray-400 text-right">
                        {t.porcentaje_atribuido != null ? `${t.porcentaje_atribuido}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Expediente */}
        {mv?.id_movimiento && (
          <div className="text-xs text-gray-400 border-t border-gray-100 pt-4">
            <p>Movimiento de devengo: <span className="font-mono">{mv.id_movimiento}</span></p>
            {mv.hash_detalle && <p>Hash expediente: <span className="font-mono">{mv.hash_detalle.slice(0, 32)}…</span></p>}
          </div>
        )}

        {estado === 'estimado_provisional' && (
          <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
            Estimado provisional — no constituye devengo. Esta comisión queda definitiva solo tras la aprobación completa del período (puerta 6 — acuse de nómina).
          </p>
        )}
      </div>
    </main>
  )
}
