import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { LogOut, Home, MessageSquareWarning } from 'lucide-react'

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/portal/login')

  const { data: comisionado } = await supabase.from('comisionados').select('identificador_personal, pais').eq('usuario_id', user.id).maybeSingle()

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="text-lg font-bold text-violet-700">Portal del comisionado</span>
          {comisionado && (
            <div className="flex gap-4 text-sm text-gray-600">
              <Link href="/portal" className="flex items-center gap-1 hover:text-gray-900"><Home size={14} /> Inicio</Link>
              <Link href="/portal/disputas" className="flex items-center gap-1 hover:text-gray-900"><MessageSquareWarning size={14} /> Disputas</Link>
            </div>
          )}
        </div>
        <form action="/api/auth/signout" method="POST">
          <button type="submit" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
            <LogOut size={14} /> Salir
          </button>
        </form>
      </nav>
      <main className="max-w-4xl mx-auto p-8">
        {!comisionado ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-500">
            <p className="text-lg mb-2">Tu cuenta todavía no está vinculada a un comisionado</p>
            <p className="text-sm">Pide a tu empresa que la vincule desde el panel de administración con tu email ({user.email}).</p>
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  )
}
