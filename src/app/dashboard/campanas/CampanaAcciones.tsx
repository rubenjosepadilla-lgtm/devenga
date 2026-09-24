'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Simulacion {
  simulacion: { costoDesdePublicacion: number; costoTodoPeriodoAbierto: number; diferencia: number; diasConBase: number }
  beneficios_afectados: { beneficio: string; ventana_calculo: string }[]
  advertencia: string
}

export function CampanaAcciones({ campanaId, estado }: { campanaId: string; estado: string }) {
  const router = useRouter()
  const [cargando, setCargando] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState('')
  const [simulacion, setSimulacion] = useState<Simulacion | null>(null)
  const [pidiendoExcepcion, setPidiendoExcepcion] = useState(false)
  const [motivoExcepcion, setMotivoExcepcion] = useState('')

  async function simular() {
    setCargando('simular')
    setMensaje('')
    const res = await fetch(`/api/campanas/${campanaId}/simular`)
    const data = await res.json()
    setCargando(null)
    if (!res.ok) { setMensaje(data.error); setSimulacion(null); return }
    setSimulacion(data)
  }

  async function autorizar() {
    setCargando('autorizar')
    setMensaje('')
    const res = await fetch(`/api/campanas/${campanaId}/autorizar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nivel_autorizacion: 'jefatura_comercial' }),
    })
    const data = await res.json()
    setCargando(null)
    if (!res.ok) { setMensaje(data.error); return }
    router.refresh()
  }

  async function publicar(conExcepcion = false) {
    setCargando('publicar')
    setMensaje('')
    const res = await fetch(`/api/campanas/${campanaId}/publicar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(conExcepcion ? { excepcion_motivo: motivoExcepcion } : {}),
    })
    const data = await res.json()
    setCargando(null)
    if (!res.ok) {
      if (data.requiere_excepcion) { setPidiendoExcepcion(true); setMensaje(data.error); return }
      setMensaje(data.error)
      return
    }
    setPidiendoExcepcion(false)
    router.refresh()
  }

  return (
    <div className="mt-2">
      <div className="flex gap-2">
        {estado === 'borrador' && (
          <>
            <button onClick={simular} disabled={cargando !== null} className="text-xs border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-40">
              {cargando === 'simular' ? 'Simulando…' : 'Simular (§3.5)'}
            </button>
            <button onClick={autorizar} disabled={cargando !== null} className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 disabled:opacity-40">
              Autorizar (puerta 3)
            </button>
          </>
        )}
        {estado === 'autorizada' && (
          <button onClick={() => publicar(false)} disabled={cargando !== null} className="text-xs bg-violet-700 text-white px-3 py-1.5 rounded-lg hover:bg-violet-800 disabled:opacity-40">
            {cargando === 'publicar' ? 'Publicando…' : 'Publicar'}
          </button>
        )}
      </div>

      {simulacion && (
        <div className="mt-3 text-xs bg-gray-50 rounded-lg p-3 space-y-1">
          <p>Costo incremental <strong>desde publicación</strong>: {simulacion.simulacion.costoDesdePublicacion.toLocaleString('es-CL')}</p>
          <p>Costo incremental <strong>todo el período abierto</strong>: {simulacion.simulacion.costoTodoPeriodoAbierto.toLocaleString('es-CL')}</p>
          <p className="text-gray-500">Diferencia: {simulacion.simulacion.diferencia.toLocaleString('es-CL')} sobre {simulacion.simulacion.diasConBase} día(s) con base</p>
          {simulacion.beneficios_afectados.length > 0 && (
            <p className="text-orange-700">Afecta: {simulacion.beneficios_afectados.map((b) => b.beneficio).join(', ')} — {simulacion.advertencia}</p>
          )}
        </div>
      )}

      {pidiendoExcepcion && (
        <div className="mt-3 text-xs bg-orange-50 rounded-lg p-3 space-y-2">
          <p className="text-orange-800">Requiere autorización de nivel superior para exceder el presupuesto (mínimo 20 caracteres):</p>
          <textarea value={motivoExcepcion} onChange={(e) => setMotivoExcepcion(e.target.value)} rows={2} className="w-full border border-orange-200 rounded-lg px-2 py-1" />
          <button onClick={() => publicar(true)} disabled={cargando !== null} className="bg-orange-700 text-white px-3 py-1.5 rounded-lg hover:bg-orange-800 disabled:opacity-40">
            Publicar con excepción de presupuesto
          </button>
        </div>
      )}

      {mensaje && !pidiendoExcepcion && <p className="mt-2 text-xs text-red-600">{mensaje}</p>}
    </div>
  )
}
