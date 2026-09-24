'use client'
import { eliminarComisionado } from './actions'

export function EliminarBtn({ comisionadoId }: { comisionadoId: string }) {
  return (
    <form action={eliminarComisionado} onSubmit={(e) => { if (!confirm('¿Eliminar este comisionado?')) e.preventDefault() }}>
      <input type="hidden" name="comisionado_id" value={comisionadoId} />
      <button type="submit" className="text-xs text-red-500 hover:text-red-700">Eliminar</button>
    </form>
  )
}
