'use client'

interface ExportarCSVProps {
  datos: Record<string, unknown>[]
  nombre: string
}

export function ExportarCSV({ datos, nombre }: ExportarCSVProps) {
  function descargar() {
    if (!datos.length) return
    const encabezados = Object.keys(datos[0])
    const filas = datos.map((fila) =>
      encabezados.map((k) => {
        const v = fila[k]
        if (v === null || v === undefined) return ''
        const s = String(v)
        return s.includes(',') || s.includes('"') || s.includes('\n')
          ? `"${s.replace(/"/g, '""')}"`
          : s
      }).join(',')
    )
    const csv = [encabezados.join(','), ...filas].join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${nombre}_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button
      onClick={descargar}
      className="bg-violet-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-violet-800"
    >
      Exportar CSV
    </button>
  )
}
