'use client'
import { useState } from 'react'

interface Componente {
  id_componente: string
  concepto_codigo: string
  tipo_calculo: 'tasa_lineal' | 'tramos' | 'fijo' | 'pool_equipo'
  parametros: Record<string, unknown>
  tope_componente?: number | null
}

function simularComponente(monto: number, comp: Componente): number {
  let resultado = 0
  switch (comp.tipo_calculo) {
    case 'tasa_lineal': {
      const tasa = Number(comp.parametros.tasa ?? 0)
      resultado = monto * tasa
      break
    }
    case 'fijo': {
      resultado = monto > 0 ? Number(comp.parametros.monto ?? 0) : 0
      break
    }
    case 'tramos': {
      const tramos = (comp.parametros.tramos as { desde: number; hasta: number; tasa: number }[]) ?? []
      const escalonado = (comp.parametros.escalonado as string) ?? 'marginal'
      if (escalonado === 'marginal') {
        for (const t of tramos) {
          const desde = t.desde ?? 0
          const hasta = t.hasta ?? Infinity
          if (monto > desde) {
            const base = Math.min(monto, hasta) - desde
            resultado += base * (t.tasa ?? 0)
          }
        }
      } else {
        // Total: aplica tasa del tramo donde cae el total
        for (const t of tramos) {
          if (monto >= (t.desde ?? 0) && monto < (t.hasta ?? Infinity)) {
            resultado = monto * (t.tasa ?? 0)
            break
          }
        }
      }
      break
    }
    default:
      resultado = 0
  }
  if (comp.tope_componente != null) resultado = Math.min(resultado, comp.tope_componente)
  return resultado
}

export function SimuladorForm({
  nombrePlan,
  componentes,
}: {
  nombrePlan: string
  componentes: Componente[]
}) {
  const [montoPorConcepto, setMontoPorConcepto] = useState<Record<string, string>>({})

  const resultados = componentes.map((comp) => {
    const montoStr = montoPorConcepto[comp.concepto_codigo] ?? ''
    const monto = parseFloat(montoStr.replace(/\./g, '').replace(',', '.')) || 0
    const comision = simularComponente(monto, comp)
    return { comp, monto, comision }
  })
  const totalSimulado = resultados.reduce((acc, r) => acc + r.comision, 0)

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <p className="text-xs text-gray-400 mb-4 font-medium">Plan: {nombrePlan}</p>
        <div className="space-y-4">
          {componentes.map((comp) => (
            <div key={comp.id_componente}>
              <label className="text-sm text-gray-700 block mb-1 font-medium">
                {comp.concepto_codigo}
                <span className="ml-2 text-xs text-gray-400 font-normal capitalize">({comp.tipo_calculo})</span>
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  inputMode="numeric"
                  value={montoPorConcepto[comp.concepto_codigo] ?? ''}
                  onChange={(e) => setMontoPorConcepto((prev) => ({ ...prev, [comp.concepto_codigo]: e.target.value }))}
                  placeholder="Monto hipotético (ej: 1000000)"
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1 max-w-xs"
                />
                {(() => {
                  const r = resultados.find((r) => r.comp.id_componente === comp.id_componente)
                  return r && r.monto > 0 ? (
                    <span className="text-sm font-semibold text-violet-700">
                      → {r.comision.toLocaleString('es-CL', { maximumFractionDigits: 0 })}
                    </span>
                  ) : null
                })()}
              </div>
            </div>
          ))}
        </div>
      </div>

      {totalSimulado > 0 && (
        <div className="bg-violet-50 border border-violet-100 rounded-2xl p-6">
          <p className="text-sm text-violet-500 mb-1">Comisión total estimada</p>
          <p className="text-3xl font-bold text-violet-700">
            {totalSimulado.toLocaleString('es-CL', { maximumFractionDigits: 0 })}
          </p>
          <p className="text-xs text-violet-400 mt-2">
            Estimación basada en el plan vigente. Sujeta a validación de las transacciones, aprobación del período y reglas de campaña que puedan estar activas.
          </p>
          <div className="mt-4 space-y-2">
            {resultados.filter((r) => r.comision > 0).map((r) => (
              <div key={r.comp.id_componente} className="flex justify-between text-sm">
                <span className="text-violet-600">{r.comp.concepto_codigo}</span>
                <span className="text-violet-700 font-medium">
                  {r.comision.toLocaleString('es-CL', { maximumFractionDigits: 0 })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
