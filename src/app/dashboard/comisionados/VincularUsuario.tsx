'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function VincularUsuario({ comisionadoId, vinculado }: { comisionadoId: string; vinculado: boolean }) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [email, setEmail] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [cargando, setCargando] = useState(false)

  if (vinculado) return <span className="text-xs text-green-700">Portal vinculado</span>

  async function vincular() {
    setCargando(true)
    setMensaje('')
    const res = await fetch(`/api/comisionados/${comisionadoId}/vincular-usuario`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const data = await res.json()
    setCargando(false)
    if (!res.ok) { setMensaje(data.error); return }
    setAbierto(false)
    router.refresh()
  }

  if (!abierto) {
    return <button onClick={() => setAbierto(true)} className="text-xs text-violet-700 hover:underline">Vincular portal</button>
  }

  return (
    <div className="flex items-center gap-2">
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email de /portal/register" className="text-xs border border-gray-200 rounded-lg px-2 py-1 w-40" />
      <button onClick={vincular} disabled={cargando || !email} className="text-xs bg-gray-900 text-white px-2 py-1 rounded-lg hover:bg-gray-800 disabled:opacity-40">
        Vincular
      </button>
      {mensaje && <span className="text-xs text-red-600">{mensaje}</span>}
    </div>
  )
}
