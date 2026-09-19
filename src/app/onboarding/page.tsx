import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { tenantDelUsuario } from '@/lib/datos/tenant'
import { PAISES_V1 } from '@/lib/dominio/tipos'
import { crearWorkspace } from './actions'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const authResult = await supabase.auth.getUser()
  const user = authResult?.data?.user ?? null

  if (!user) redirect('/login')

  const ctx = await tenantDelUsuario()
  if (ctx) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <span className="text-2xl font-bold text-violet-700">Devenga</span>
          <h1 className="mt-4 text-xl font-semibold text-gray-900">Crea tu workspace</h1>
          <p className="mt-2 text-sm text-gray-500">
            Configura el nombre de tu empresa y el país base para comenzar.
          </p>
        </div>

        <form action={crearWorkspace} className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre de la empresa
            </label>
            <input
              name="nombre_comercial"
              required
              placeholder="Ej: Distribuidora Comercial S.A."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              País base
            </label>
            <select
              name="pais_base"
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              {PAISES_V1.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-400">
              Determina los conceptos de comisiones y la normativa laboral aplicada por defecto.
            </p>
          </div>

          <button
            type="submit"
            className="w-full bg-violet-700 hover:bg-violet-800 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
          >
            Crear workspace
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-gray-400">
          Puedes agregar más países y sociedades después de crear el workspace.
        </p>
      </div>
    </div>
  )
}
