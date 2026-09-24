'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function PortalRegisterPage() {
  const [form, setForm] = useState({ nombre: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  function set(field: string) { return (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [field]: e.target.value })) }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { nombre: form.nombre } },
    })
    if (signUpError) { setError(signUpError.message); setLoading(false); return }
    if (data.user) {
      await supabase.from('usuarios_app').insert({ id: data.user.id, nombre: form.nombre, email: form.email })
    }
    router.push('/portal')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-md">
        <span className="text-2xl font-bold text-violet-700 block">Comisiones</span>
        <span className="text-xs text-gray-400 block mb-2">Portal del comisionado</span>
        <p className="text-sm text-gray-400 mb-8">
          Crea tu cuenta y pide a tu empresa que la vincule a tu ficha de comisionado.
        </p>
        <form onSubmit={handleRegister} className="space-y-4">
          {[
            { label: 'Nombre completo', field: 'nombre', type: 'text' },
            { label: 'Email', field: 'email', type: 'email' },
            { label: 'Contraseña', field: 'password', type: 'password' },
          ].map(({ label, field, type }) => (
            <div key={field}>
              <label className="text-sm font-medium text-gray-700">{label}</label>
              <input type={type} value={form[field as keyof typeof form]} onChange={set(field)} required
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
          ))}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full bg-violet-700 text-white py-2 rounded-lg text-sm font-medium hover:bg-violet-800 disabled:opacity-50">
            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>
        </form>
        <p className="text-sm text-gray-500 mt-4 text-center">
          ¿Ya tienes cuenta? <Link href="/portal/login" className="text-violet-700 hover:underline">Inicia sesión</Link>
        </p>
      </div>
    </div>
  )
}
