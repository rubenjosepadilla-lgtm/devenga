'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export function AceptarPlanForm({ acuseId }: { acuseId: string }) {
  const [motivo, setMotivo] = useState('')
  const [cargando, setCargando] = useState<'aceptar' | 'rechazar' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function responder(accion: 'aceptar' | 'rechazar') {
    if (accion === 'rechazar' && motivo.trim().length < 5) {
      setError('El motivo de rechazo debe tener al menos 5 caracteres')
      return
    }
    setCargando(accion)
    setError(null)
    const supabase = createClient()
    const { error: err } = await supabase.rpc('responder_acuse_plan', {
      p_acuse_id: acuseId,
      p_accion: accion,
      p_motivo: accion === 'rechazar' ? motivo : null,
    })
    setCargando(null)
    if (err) { setError(err.message); return }
    router.refresh()
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-gray-500 block mb-1">Motivo de rechazo (obligatorio si rechazas)</label>
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={2}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
          placeholder="Escribe el motivo…"
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-3">
        <button
          onClick={() => responder('aceptar')}
          disabled={cargando !== null}
          className="bg-violet-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-violet-800 disabled:opacity-40"
        >
          {cargando === 'aceptar' ? 'Aceptando…' : 'Aceptar plan'}
        </button>
        <button
          onClick={() => responder('rechazar')}
          disabled={cargando !== null}
          className="border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm hover:bg-red-50 disabled:opacity-40"
        >
          {cargando === 'rechazar' ? 'Rechazando…' : 'Rechazar'}
        </button>
      </div>
    </div>
  )
}
