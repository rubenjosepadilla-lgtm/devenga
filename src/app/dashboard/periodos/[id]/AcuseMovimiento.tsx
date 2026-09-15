'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

/** Puerta 6 (§4.1) / §3.9 — registra el acuse de nómina para un movimiento. */
export function AcuseMovimiento({ movimientoId, estado }: { movimientoId: string; estado: string }) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [monto, setMonto] = useState('')
  const [fecha, setFecha] = useState('')
  const [idDocumento, setIdDocumento] = useState('')
  const [estadoAcuse, setEstadoAcuse] = useState<'acusado' | 'pagado'>('pagado')
  const [mensaje, setMensaje] = useState('')
  const [enviando, setEnviando] = useState(false)

  if (estado === 'pagado') return <span className="text-xs text-green-700">Pagado</span>

  async function registrar() {
    setEnviando(true)
    setMensaje('')
    const res = await fetch(`/api/movimientos/${movimientoId}/acuse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        monto_bruto_pagado: Number(monto),
        estado: estadoAcuse,
        id_documento_publicado: idDocumento || movimientoId,
        fecha,
      }),
    })
    const data = await res.json()
    setEnviando(false)
    if (!res.ok) { setMensaje(data.error); return }
    setAbierto(false)
    router.refresh()
  }

  if (!abierto) {
    return <button onClick={() => setAbierto(true)} className="text-xs text-violet-700 hover:underline">Registrar acuse</button>
  }

  return (
    <div className="space-y-1 text-xs bg-gray-50 rounded-lg p-2 w-48">
      <input type="number" step="0.01" placeholder="Monto bruto pagado" value={monto} onChange={(e) => setMonto(e.target.value)} className="w-full border border-gray-200 rounded px-2 py-1" />
      <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full border border-gray-200 rounded px-2 py-1" />
      <input placeholder="ID documento publicado" value={idDocumento} onChange={(e) => setIdDocumento(e.target.value)} className="w-full border border-gray-200 rounded px-2 py-1" />
      <select value={estadoAcuse} onChange={(e) => setEstadoAcuse(e.target.value as 'acusado' | 'pagado')} className="w-full border border-gray-200 rounded px-2 py-1">
        <option value="pagado">Pagado</option>
        <option value="acusado">Acusado (aún no pagado)</option>
      </select>
      <button onClick={registrar} disabled={enviando || !monto || !fecha} className="w-full bg-gray-900 text-white rounded py-1 disabled:opacity-40">
        Confirmar
      </button>
      {mensaje && <p className="text-red-600">{mensaje}</p>}
    </div>
  )
}
