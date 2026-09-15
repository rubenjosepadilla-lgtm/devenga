import Link from 'next/link'
import { sociedadesDelUsuario } from '@/lib/datos/sociedad-activa'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardHome() {
  const sociedades = await sociedadesDelUsuario()

  if (sociedades.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 mb-8">Panel de control</h1>
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400">
          <p className="text-lg mb-2">👋 Comienza creando tu primera sociedad</p>
          <p className="text-sm mb-6">Una sociedad es el empleador cuya nómina recibirá los movimientos de devengo (§2.2).</p>
          <Link href="/dashboard/sociedades" className="inline-block bg-violet-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-violet-800">
            Crear sociedad
          </Link>
        </div>
      </div>
    )
  }

  const supabase = await createClient()
  const idsSociedad = sociedades.map((s) => s.id_sociedad)

  const [{ count: totalComisionados }, { count: transaccionesEnCuarentena }, { count: periodosAbiertos }] = await Promise.all([
    supabase.from('comisionado_sociedad').select('*', { count: 'exact', head: true }).in('sociedad_id', idsSociedad),
    supabase.from('transacciones_cuarentena').select('*, fuentes!inner(sociedad_id)', { count: 'exact', head: true }).eq('resuelto', false).in('fuentes.sociedad_id', idsSociedad),
    supabase.from('periodos').select('*', { count: 'exact', head: true }).in('sociedad_id', idsSociedad).eq('estado', 'abierto'),
  ])

  const stats = [
    { label: 'Comisionados vinculados', value: totalComisionados ?? 0, color: 'text-violet-700' },
    { label: 'En cuarentena sin resolver', value: transaccionesEnCuarentena ?? 0, color: 'text-orange-500' },
    { label: 'Períodos abiertos', value: periodosAbiertos ?? 0, color: 'text-blue-600' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-8">Panel de control</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-6">
            <p className="text-sm text-gray-500 mb-2">{s.label}</p>
            <p className={`text-4xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <p className="text-sm text-gray-500">
          Tus sociedades: {sociedades.map((s) => `${s.nombre} (${s.pais})`).join(', ')}
        </p>
      </div>
    </div>
  )
}
