'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function AbrirDisputaForm({ comisionadoId, sociedadId, resultados }: {
  comisionadoId: string
  sociedadId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resultados: any[]
}) {
  const router = useRouter()
  const [referenciaId, setReferenciaId] = useState(resultados[0]?.id_resultado ?? '')
  const [clasificacion, setClasificacion] = useState('monto')
  const [descripcion, setDescripcion] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function abrir(e: React.FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setMensaje('')
    const res = await fetch('/api/disputas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        comisionado_id: comisionadoId,
        sociedad_id: sociedadId,
        referencia_tipo: 'concepto',
        referencia_id: referenciaId,
        clasificacion,
        descripcion,
      }),
    })
    const data = await res.json()
    setEnviando(false)
    if (!res.ok) { setMensaje(data.error); return }
    setDescripcion('')
    router.refresh()
  }

  if (resultados.length === 0) {
    return <p className="text-sm text-gray-400">Necesitas al menos una comisión calculada para abrir una disputa.</p>
  }

  return (
    <form onSubmit={abrir} className="space-y-4">
      <div>
        <label className="text-sm font-medium text-gray-700">Comisión en disputa</label>
        <select value={referenciaId} onChange={(e) => setReferenciaId(e.target.value)} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {resultados.map((r: any) => (
            <option key={r.id_resultado} value={r.id_resultado}>{r.concepto_codigo} — {r.importe.toLocaleString('es-CL')} {r.moneda}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700">Tipo</label>
        <select value={clasificacion} onChange={(e) => setClasificacion(e.target.value)} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
          <option value="atribucion">Atribución</option>
          <option value="monto">Monto</option>
          <option value="meta">Meta</option>
          <option value="campana">Campaña</option>
          <option value="plan">Plan</option>
          <option value="pago">Pago</option>
        </select>
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700">Descripción</label>
        <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} required minLength={10} rows={3} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
      </div>
      {mensaje && <p className="text-sm text-red-600">{mensaje}</p>}
      <button type="submit" disabled={enviando} className="bg-violet-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-violet-800 disabled:opacity-50">
        {enviando ? 'Enviando…' : 'Abrir disputa'}
      </button>
    </form>
  )
}
