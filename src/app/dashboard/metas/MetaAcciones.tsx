'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function MetaAcciones({ metaId, estado }: { metaId: string; estado: string }) {
  const router = useRouter()
  const [cargando, setCargando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [corrigiendo, setCorrigiendo] = useState(false)
  const [magnitud, setMagnitud] = useState('')
  const [motivo, setMotivo] = useState('')

  async function accion(ruta: string, body?: unknown) {
    setCargando(true)
    setMensaje('')
    const res = await fetch(`/api/metas/${metaId}/${ruta}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    })
    const data = await res.json()
    setCargando(false)
    if (!res.ok) { setMensaje(data.error); return }
    setCorrigiendo(false)
    router.refresh()
  }

  return (
    <div>
      <div className="flex gap-2">
        {estado === 'borrador' && (
          <button onClick={() => accion('enviar-aprobacion')} disabled={cargando} className="text-xs bg-gray-900 text-white px-2 py-1 rounded-lg hover:bg-gray-800 disabled:opacity-40">
            Enviar a aprobación
          </button>
        )}
        {estado === 'en_aprobacion' && (
          <button onClick={() => accion('aprobar')} disabled={cargando} className="text-xs bg-violet-700 text-white px-2 py-1 rounded-lg hover:bg-violet-800 disabled:opacity-40">
            Aprobar
          </button>
        )}
        <button onClick={() => setCorrigiendo((v) => !v)} className="text-xs border border-gray-200 px-2 py-1 rounded-lg hover:bg-gray-50">
          Corregir
        </button>
      </div>
      {corrigiendo && (
        <div className="mt-2 space-y-2 bg-gray-50 rounded-lg p-3">
          <input type="number" step="0.01" placeholder="Nueva magnitud" value={magnitud} onChange={(e) => setMagnitud(e.target.value)} className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs" />
          <textarea placeholder="Motivo de la corrección (obligatorio)" value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs" />
          <button
            onClick={() => accion('corregir', { magnitud: Number(magnitud), motivo_version: motivo })}
            disabled={cargando || !magnitud || !motivo}
            className="text-xs bg-gray-900 text-white px-2 py-1 rounded-lg hover:bg-gray-800 disabled:opacity-40"
          >
            Crear nueva versión
          </button>
        </div>
      )}
      {mensaje && <p className="mt-1 text-xs text-red-600">{mensaje}</p>}
    </div>
  )
}
