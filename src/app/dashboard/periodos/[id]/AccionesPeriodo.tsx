'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Clock, XCircle } from 'lucide-react'

// Estados del workflow de aprobación (§4.1)
const FLUJO_ESTADOS: Record<string, { label: string; siguiente: string | null; puerta: number | null }> = {
  abierto:             { label: 'Abierto',             siguiente: 'calculado',          puerta: null },
  en_calculo:          { label: 'En cálculo…',         siguiente: null,                  puerta: null },
  calculado:           { label: 'Calculado',           siguiente: 'revision_jefe',       puerta: 4 },
  revision_jefe:       { label: 'Revisión jefe',       siguiente: 'aprobacion_gerencia', puerta: 5 },
  aprobacion_gerencia: { label: 'Aprobación gerencia', siguiente: 'aprobado',            puerta: 5 },
  aprobado:            { label: 'Aprobado',            siguiente: 'cerrado',             puerta: null },
  cerrado:             { label: 'Cerrado',             siguiente: null,                  puerta: null },
}

const ESTADO_COLOR: Record<string, string> = {
  abierto:             'bg-gray-100 text-gray-600',
  en_calculo:          'bg-blue-50 text-blue-700',
  calculado:           'bg-yellow-50 text-yellow-700',
  revision_jefe:       'bg-indigo-50 text-indigo-700',
  aprobacion_gerencia: 'bg-indigo-50 text-indigo-700',
  aprobado:            'bg-green-50 text-green-700',
  cerrado:             'bg-gray-900 text-white',
}

export function AccionesPeriodo({
  periodoId,
  estado,
  aprobaciones,
}: {
  periodoId: string
  estado: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  aprobaciones?: any[]
}) {
  const [cargando, setCargando] = useState<'calcular' | 'cerrar' | 'controles' | 'aprobar' | null>(null)
  const [mensaje, setMensaje] = useState<string>('')
  const [violaciones, setViolaciones] = useState<{ control: string; detalle: string }[]>([])
  const [listo, setListo] = useState<boolean | null>(null)
  const [comentario, setComentario] = useState('')
  const router = useRouter()

  const flujo = FLUJO_ESTADOS[estado] ?? FLUJO_ESTADOS.abierto

  async function revisarControles() {
    setCargando('controles')
    setMensaje('')
    const res = await fetch(`/api/periodos/${periodoId}/controles`)
    const data = await res.json()
    setCargando(null)
    if (!res.ok) { setMensaje(data.error ?? 'Error al revisar controles'); return }
    setListo(data.listo_para_cerrar)
    setViolaciones(data.violaciones ?? [])
  }

  async function calcular() {
    setCargando('calcular')
    setMensaje('')
    setViolaciones([])
    setListo(null)
    const res = await fetch(`/api/periodos/${periodoId}/calcular`, { method: 'POST' })
    const data = await res.json()
    setCargando(null)
    if (!res.ok) { setMensaje(data.error ?? 'Error al calcular'); return }
    setMensaje(`Cálculo listo: ${data.resultados} resultado(s), total ${data.total?.toLocaleString('es-CL')}. ${data.errores?.length ? `${data.errores.length} advertencia(s).` : ''}`)
    router.refresh()
  }

  async function cerrar() {
    setCargando('cerrar')
    setMensaje('')
    setViolaciones([])
    setListo(null)
    const res = await fetch(`/api/periodos/${periodoId}/cerrar`, { method: 'POST' })
    const data = await res.json()
    setCargando(null)
    if (!res.ok) {
      setMensaje(data.error ?? 'Error al cerrar')
      setViolaciones(data.violaciones ?? [])
      return
    }
    setMensaje(`Período cerrado — ${data.movimientos_generados} movimiento(s) de devengo generados.`)
    router.refresh()
  }

  async function aprobarPuerta(puerta: number) {
    setCargando('aprobar')
    setMensaje('')
    const res = await fetch(`/api/periodos/${periodoId}/aprobar-puerta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ puerta_numero: puerta, comentario: comentario || null }),
    })
    const data = await res.json()
    setCargando(null)
    if (!res.ok) { setMensaje(data.error ?? 'Error al aprobar'); return }
    setMensaje(`Puerta ${puerta} aprobada — nuevo estado: ${data.nuevo_estado ?? '—'}`)
    setComentario('')
    router.refresh()
  }

  // Pasos del workflow para visualización
  const pasos = [
    { key: 'abierto',             label: '1. Abierto' },
    { key: 'calculado',           label: '2. Calculado' },
    { key: 'revision_jefe',       label: '3. Rev. jefe' },
    { key: 'aprobacion_gerencia', label: '4. Aprobación gerencia' },
    { key: 'aprobado',            label: '5. Aprobado' },
    { key: 'cerrado',             label: '6. Cerrado' },
  ]
  const idxActual = pasos.findIndex((p) => p.key === estado)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-8 space-y-6">

      {/* Barra de progreso del workflow */}
      <div>
        <p className="text-xs text-gray-400 mb-3 font-medium uppercase tracking-wide">Workflow de aprobación (§4.1)</p>
        <div className="flex items-center gap-1">
          {pasos.map((p, i) => {
            const done = i < idxActual
            const active = i === idxActual
            return (
              <div key={p.key} className="flex items-center gap-1 flex-1 min-w-0">
                <div className="flex flex-col items-center min-w-0">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    done ? 'bg-green-500 text-white' : active ? 'bg-violet-700 text-white' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {done ? '✓' : i + 1}
                  </div>
                  <span className={`text-xs mt-1 text-center leading-tight ${active ? 'text-violet-700 font-medium' : done ? 'text-green-600' : 'text-gray-400'}`}>
                    {p.label}
                  </span>
                </div>
                {i < pasos.length - 1 && (
                  <div className={`h-0.5 flex-1 -mt-4 ${i < idxActual ? 'bg-green-400' : 'bg-gray-100'}`} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Acciones según el estado actual */}
      <div className="space-y-3">

        {/* Estado: abierto — calcular y controles */}
        {estado === 'abierto' && (
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={calcular}
              disabled={cargando !== null}
              className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-40"
            >
              {cargando === 'calcular' ? 'Calculando…' : 'Calcular período (§3.3)'}
            </button>
            <button
              onClick={revisarControles}
              disabled={cargando !== null}
              className="border border-gray-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-40"
            >
              {cargando === 'controles' ? 'Revisando…' : 'Revisar controles (§4.2)'}
            </button>
          </div>
        )}

        {/* Estado: calculado — primer paso de aprobación (puerta 4 = congelamiento de cálculo) */}
        {estado === 'calculado' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              El cálculo está listo. Para avanzar al siguiente paso, aprueba el congelamiento (puerta 4 — §4.1).
              Esto bloquea los resultados y los envía a revisión del jefe.
            </p>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Comentario opcional</label>
              <input
                type="text"
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-full max-w-md"
                placeholder="Observaciones…"
              />
            </div>
            <button
              onClick={() => aprobarPuerta(4)}
              disabled={cargando !== null}
              className="bg-violet-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-violet-800 disabled:opacity-40"
            >
              {cargando === 'aprobar' ? 'Aprobando…' : 'Aprobar cálculo → Enviar a revisión jefe (puerta 4)'}
            </button>
          </div>
        )}

        {/* Estado: revision_jefe — puerta 5 */}
        {estado === 'revision_jefe' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              En revisión del jefe comercial. El jefe debe aprobar los resultados de su equipo para avanzar a aprobación de gerencia (puerta 5).
            </p>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Comentario del jefe</label>
              <input
                type="text"
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-full max-w-md"
                placeholder="Observaciones del jefe…"
              />
            </div>
            <button
              onClick={() => aprobarPuerta(5)}
              disabled={cargando !== null}
              className="bg-violet-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-violet-800 disabled:opacity-40"
            >
              {cargando === 'aprobar' ? 'Aprobando…' : 'Aprobar como jefe → Enviar a gerencia (puerta 5)'}
            </button>
          </div>
        )}

        {/* Estado: aprobacion_gerencia — aprobación final antes de cerrar */}
        {estado === 'aprobacion_gerencia' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              En aprobación de gerencia / control de gestión. Al aprobar, el período queda listo para cerrarse y generar movimientos de devengo.
            </p>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Comentario de gerencia</label>
              <input
                type="text"
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-full max-w-md"
                placeholder="Aprobado / Observaciones…"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => aprobarPuerta(5)}
                disabled={cargando !== null}
                className="bg-violet-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-violet-800 disabled:opacity-40"
              >
                {cargando === 'aprobar' ? 'Aprobando…' : 'Aprobar liquidación → Marcar como aprobado (puerta 5)'}
              </button>
            </div>
          </div>
        )}

        {/* Estado: aprobado — cerrar y generar movimientos */}
        {estado === 'aprobado' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              El período está aprobado. Puedes cerrarlo ahora: se generarán los movimientos de devengo y el período quedará inmutable.
            </p>
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={revisarControles}
                disabled={cargando !== null}
                className="border border-gray-200 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-40"
              >
                {cargando === 'controles' ? 'Revisando…' : 'Revisar controles (§4.2)'}
              </button>
              <button
                onClick={cerrar}
                disabled={cargando !== null}
                className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-40"
              >
                {cargando === 'cerrar' ? 'Cerrando…' : 'Cerrar período y generar movimientos (§3.6)'}
              </button>
            </div>
          </div>
        )}

        {/* Estado: cerrado */}
        {estado === 'cerrado' && (
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle2 size={16} />
            <p className="text-sm font-medium">Período cerrado — inmutable. Los movimientos de devengo han sido generados.</p>
          </div>
        )}

        {/* Historial de aprobaciones */}
        {aprobaciones && aprobaciones.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">Historial de aprobaciones</p>
            <div className="space-y-1">
              {aprobaciones.map((a) => (
                <div key={a.id} className="flex items-center gap-3 text-xs text-gray-500">
                  {a.estado === 'aprobado'
                    ? <CheckCircle2 size={12} className="text-green-500 shrink-0" />
                    : a.estado === 'rechazado'
                    ? <XCircle size={12} className="text-red-500 shrink-0" />
                    : <Clock size={12} className="text-gray-300 shrink-0" />}
                  <span>Puerta {a.puerta_numero}</span>
                  <span>·</span>
                  <span>{a.estado}</span>
                  {a.aprobado_en && <span>· {new Date(a.aprobado_en).toLocaleDateString('es-CL')}</span>}
                  {a.comentario && <span>· &quot;{a.comentario}&quot;</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Mensajes de resultado */}
      {mensaje && <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">{mensaje}</p>}
      {listo === true && violaciones.length === 0 && (
        <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
          ✓ Sin controles bloqueantes activos — el período puede cerrarse.
        </p>
      )}
      {violaciones.length > 0 && (
        <div className="bg-red-50 rounded-lg px-3 py-2">
          <ul className="text-sm text-red-600 list-disc list-inside space-y-1">
            {violaciones.map((v, i) => (
              <li key={i}><strong>{v.control}:</strong> {v.detalle}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
