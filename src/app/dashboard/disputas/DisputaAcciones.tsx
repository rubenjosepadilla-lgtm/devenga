'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function DisputaAcciones({ disputaId, estado }: { disputaId: string; estado: string }) {
  const router = useRouter()
  const [cargando, setCargando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [resolviendo, setResolviendo] = useState<'aceptar' | 'rechazar' | null>(null)
  const [motivo, setMotivo] = useState('')
  const [generaAjuste, setGeneraAjuste] = useState(false)

  async function asignar() {
    setCargando(true)
    setMensaje('')
    const res = await fetch(`/api/disputas/${disputaId}/asignar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    const data = await res.json()
    setCargando(false)
    if (!res.ok) { setMensaje(data.error); return }
    router.refresh()
  }

  async function resolver(aceptar: boolean) {
    setCargando(true)
    setMensaje('')
    const res = await fetch(`/api/disputas/${disputaId}/resolver`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aceptar, motivo_resolucion: motivo, genera_ajuste: generaAjuste }),
    })
    const data = await res.json()
    setCargando(false)
    if (!res.ok) { setMensaje(data.error); return }
    setResolviendo(null)
    router.refresh()
  }

  return (
    <div>
      <div className="flex gap-2">
        {estado === 'abierta' && (
          <button onClick={asignar} disabled={cargando} className="text-xs bg-gray-900 text-white px-2 py-1 rounded-lg hover:bg-gray-800 disabled:opacity-40">Asignarme</button>
        )}
        {(estado === 'asignada' || estado === 'en_resolucion') && (
          <>
            <button onClick={() => setResolviendo('aceptar')} className="text-xs bg-violet-700 text-white px-2 py-1 rounded-lg hover:bg-violet-800">Aceptar</button>
            <button onClick={() => setResolviendo('rechazar')} className="text-xs border border-gray-200 px-2 py-1 rounded-lg hover:bg-gray-50">Rechazar</button>
          </>
        )}
      </div>
      {resolviendo && (
        <div className="mt-2 space-y-2 bg-gray-50 rounded-lg p-3">
          <textarea placeholder="Motivo de la resolución (obligatorio)" value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs" />
          {resolviendo === 'aceptar' && (
            <label className="flex items-center gap-2 text-xs text-gray-600">
              <input type="checkbox" checked={generaAjuste} onChange={(e) => setGeneraAjuste(e.target.checked)} />
              Requiere generar un movimiento de ajuste (§3.11, manual)
            </label>
          )}
          <button
            onClick={() => resolver(resolviendo === 'aceptar')}
            disabled={cargando || motivo.trim().length < 10}
            className="text-xs bg-gray-900 text-white px-2 py-1 rounded-lg hover:bg-gray-800 disabled:opacity-40"
          >
            Confirmar {resolviendo}
          </button>
        </div>
      )}
      {mensaje && <p className="mt-1 text-xs text-red-600">{mensaje}</p>}
    </div>
  )
}
