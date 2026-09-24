'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Fuente { id_fuente: string; sistema: string }
interface Comisionado { comisionado_id: string; identificador_personal: string }
interface Sociedad { id_sociedad: string; nombre: string; pais: string }

export function IngestaForm({ sociedades, fuentes, comisionados }: { sociedades: Sociedad[]; fuentes: Fuente[]; comisionados: Comisionado[] }) {
  const router = useRouter()
  const [splits, setSplits] = useState([{ comisionado_id: comisionados[0]?.comisionado_id ?? '', porcentaje: 100 }])
  const [mensaje, setMensaje] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setEnviando(true)
    setMensaje('')
    const fd = new FormData(e.currentTarget)
    const sociedad = sociedades.find((s) => s.id_sociedad === fd.get('sociedad_id'))

    const body = {
      transaccion: {
        fuente_id: fd.get('fuente_id'),
        sociedad_id: fd.get('sociedad_id'),
        pais: sociedad?.pais,
        fecha_hecho: fd.get('fecha_hecho'),
        fecha_credito: fd.get('fecha_hecho'),
        tipo_evento: fd.get('tipo_evento'),
        producto: fd.get('producto') || undefined,
        canal: fd.get('canal') || undefined,
        monto_bruto: Number(fd.get('monto_bruto')),
        moneda: fd.get('moneda'),
        clave_natural: fd.get('clave_natural'),
      },
      splits,
    }

    const res = await fetch('/api/transacciones', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json()
    setEnviando(false)
    if (!res.ok) { setMensaje(`Error: ${data.error}`); return }
    setMensaje(data.estado === 'cuarentena' ? `En cuarentena: ${data.motivo}` : `Ingestada — estado: ${data.estado}`)
    router.refresh()
  }

  function actualizarSplit(idx: number, campo: 'comisionado_id' | 'porcentaje', valor: string) {
    setSplits((prev) => prev.map((s, i) => (i === idx ? { ...s, [campo]: campo === 'porcentaje' ? Number(valor) : valor } : s)))
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-gray-700">Sociedad</label>
          <select name="sociedad_id" required className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
            {sociedades.map((s) => <option key={s.id_sociedad} value={s.id_sociedad}>{s.nombre} ({s.pais})</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700">Fuente</label>
          <select name="fuente_id" required className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
            {fuentes.map((f) => <option key={f.id_fuente} value={f.id_fuente}>{f.sistema}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-gray-700">Fecha del hecho</label>
          <input type="date" name="fecha_hecho" required className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700">Tipo de evento</label>
          <select name="tipo_evento" required className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
            <option value="factura">Factura</option>
            <option value="firma">Firma</option>
            <option value="despacho">Despacho</option>
            <option value="nota_credito">Nota de crédito</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-gray-700">Monto bruto</label>
          <input type="number" step="0.01" name="monto_bruto" required className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700">Moneda</label>
          <input name="moneda" required placeholder="CLP" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-gray-700">Producto (opcional)</label>
          <input name="producto" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700">Canal (opcional)</label>
          <input name="canal" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700">Clave natural (idempotencia)</label>
        <input name="clave_natural" required placeholder="id único del registro en el sistema origen" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-2">Splits (deben sumar 100%)</label>
        {splits.map((s, idx) => (
          <div key={idx} className="grid grid-cols-2 gap-3 mb-2">
            <select value={s.comisionado_id} onChange={(e) => actualizarSplit(idx, 'comisionado_id', e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
              {comisionados.map((c) => <option key={c.comisionado_id} value={c.comisionado_id}>{c.identificador_personal}</option>)}
            </select>
            <input type="number" value={s.porcentaje} onChange={(e) => actualizarSplit(idx, 'porcentaje', e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>
        ))}
        <button type="button" onClick={() => setSplits((p) => [...p, { comisionado_id: comisionados[0]?.comisionado_id ?? '', porcentaje: 0 }])} className="text-xs text-violet-700 hover:underline">
          + agregar split
        </button>
      </div>

      {mensaje && <p className="text-sm text-gray-600">{mensaje}</p>}
      <button type="submit" disabled={enviando} className="bg-violet-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-violet-800 disabled:opacity-50">
        {enviando ? 'Ingestando…' : 'Ingestar transacción'}
      </button>
    </form>
  )
}
