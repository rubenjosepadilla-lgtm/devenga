'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function AccionesPeriodo({ periodoId, estado }: { periodoId: string; estado: string }) {
  const [cargando, setCargando] = useState<'calcular' | 'cerrar' | 'controles' | null>(null)
  const [mensaje, setMensaje] = useState<string>('')
  const [violaciones, setViolaciones] = useState<{ control: string; detalle: string }[]>([])
  const [listo, setListo] = useState<boolean | null>(null)
  const router = useRouter()

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

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-8">
      <div className="flex gap-3 mb-3">
        <button
          onClick={calcular}
          disabled={estado !== 'abierto' || cargando !== null}
          className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-40"
        >
          {cargando === 'calcular' ? 'Calculando…' : 'Calcular período (§3.3)'}
        </button>
        <button
          onClick={revisarControles}
          disabled={estado !== 'abierto' || cargando !== null}
          className="border border-gray-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-40"
        >
          {cargando === 'controles' ? 'Revisando…' : 'Revisar controles (§4.2)'}
        </button>
        <button
          onClick={cerrar}
          disabled={estado !== 'abierto' || cargando !== null}
          className="bg-violet-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-violet-800 disabled:opacity-40"
        >
          {cargando === 'cerrar' ? 'Cerrando…' : 'Cerrar período (§4.2)'}
        </button>
      </div>
      {mensaje && <p className="text-sm text-gray-600">{mensaje}</p>}
      {listo === true && violaciones.length === 0 && <p className="text-sm text-green-700">Sin controles bloqueantes activos — el período puede cerrarse.</p>}
      {violaciones.length > 0 && (
        <ul className="mt-2 text-sm text-red-600 list-disc list-inside space-y-1">
          {violaciones.map((v, i) => <li key={i}><strong>{v.control}:</strong> {v.detalle}</li>)}
        </ul>
      )}
    </div>
  )
}
