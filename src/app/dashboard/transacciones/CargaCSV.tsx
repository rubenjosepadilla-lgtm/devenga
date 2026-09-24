'use client'
import { useRef, useState, useTransition } from 'react'
import { cargaMasivaTransacciones } from './actions'

interface Fila {
  fecha_hecho: string
  tipo_evento: string
  monto: string
  moneda: string
  producto: string
  canal: string
}

interface Props {
  sociedad_id: string
  fuente_id: string
}

export function CargaCSVTransacciones({ sociedad_id, fuente_id }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<Fila[]>([])
  const [allRows, setAllRows] = useState<Fila[]>([])
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const [isPending, startTransition] = useTransition()

  function parsearCSV(texto: string) {
    const lineas = texto.trim().split('\n').filter(Boolean)
    if (lineas.length < 2) { setError('El archivo debe tener encabezado y al menos una fila'); return }
    const encabezados = lineas[0].split(',').map((h) => h.trim().toLowerCase())
    const filas: Fila[] = lineas.slice(1).map((linea) => {
      const cols = linea.split(',').map((c) => c.trim())
      const get = (k: string) => cols[encabezados.indexOf(k)] ?? ''
      return {
        fecha_hecho: get('fecha_hecho'),
        tipo_evento: get('tipo_evento'),
        monto: get('monto'),
        moneda: get('moneda') || 'CLP',
        producto: get('producto'),
        canal: get('canal'),
      }
    })
    setAllRows(filas)
    setPreview(filas.slice(0, 5))
    setError(null)
    setOk(false)
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => parsearCSV(ev.target?.result as string)
    reader.readAsText(file, 'utf-8')
  }

  function enviar() {
    if (!allRows.length) return
    startTransition(async () => {
      const fd = new FormData()
      fd.append('sociedad_id', sociedad_id)
      fd.append('fuente_id', fuente_id)
      fd.append('filas', JSON.stringify(allRows))
      try {
        await cargaMasivaTransacciones(fd)
        setOk(true)
        setAllRows([])
        setPreview([])
        if (inputRef.current) inputRef.current.value = ''
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al importar')
      }
    })
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 mt-8">
      <h2 className="text-sm font-semibold text-gray-900 mb-1">Carga masiva de transacciones (CSV)</h2>
      <p className="text-xs text-gray-400 mb-4">
        Columnas esperadas: <code>fecha_hecho, tipo_evento, monto, moneda, producto, canal</code>
      </p>
      <input ref={inputRef} type="file" accept=".csv,text/csv" onChange={onFile}
        className="block mb-4 text-sm text-gray-600 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-violet-50 file:text-violet-700 file:text-xs file:font-medium" />

      {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
      {ok && <p className="text-xs text-green-600 mb-3">Importación completada.</p>}

      {preview.length > 0 && (
        <>
          <p className="text-xs text-gray-500 mb-2">Vista previa ({allRows.length} filas totales):</p>
          <div className="overflow-x-auto rounded-lg border border-gray-100 mb-4">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  {['fecha_hecho','tipo_evento','monto','moneda','producto','canal'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((f, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="px-3 py-2">{f.fecha_hecho}</td>
                    <td className="px-3 py-2">{f.tipo_evento}</td>
                    <td className="px-3 py-2">{f.monto}</td>
                    <td className="px-3 py-2">{f.moneda}</td>
                    <td className="px-3 py-2">{f.producto}</td>
                    <td className="px-3 py-2">{f.canal}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={enviar} disabled={isPending}
            className="bg-violet-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-violet-800 disabled:opacity-50">
            {isPending ? 'Importando…' : `Importar ${allRows.length} filas`}
          </button>
        </>
      )}
    </div>
  )
}
