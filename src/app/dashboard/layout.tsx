import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  LogOut, LayoutDashboard, Building2, Users, FileText, Target, Megaphone, Upload, CalendarClock, MessageSquareWarning,
} from 'lucide-react'
import { sociedadesDelUsuario } from '@/lib/datos/sociedad-activa'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const sociedades = await sociedadesDelUsuario()

  const nav = [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Inicio' },
    { href: '/dashboard/sociedades', icon: Building2, label: 'Sociedades' },
    { href: '/dashboard/comisionados', icon: Users, label: 'Comisionados' },
    { href: '/dashboard/planes', icon: FileText, label: 'Planes' },
    { href: '/dashboard/metas', icon: Target, label: 'Metas' },
    { href: '/dashboard/campanas', icon: Megaphone, label: 'Campañas' },
    { href: '/dashboard/transacciones', icon: Upload, label: 'Transacciones' },
    { href: '/dashboard/periodos', icon: CalendarClock, label: 'Períodos' },
    { href: '/dashboard/disputas', icon: MessageSquareWarning, label: 'Disputas' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="w-60 bg-white border-r border-gray-100 flex flex-col">
        <div className="px-5 py-5 border-b border-gray-100">
          <span className="text-lg font-bold text-violet-700">Motor de Comisiones</span>
          <p className="text-xs text-gray-400 mt-1">
            {sociedades.length > 0 ? `${sociedades.length} sociedad(es)` : 'Sin sociedades aún'}
          </p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {nav.map(({ href, icon: Icon, label }) => (
            <Link key={href} href={href} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900">
              <Icon size={16} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-gray-100">
          <p className="text-xs text-gray-500 px-3 mb-2 truncate">{user.email}</p>
          <form action="/api/auth/signout" method="POST">
            <button type="submit" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 hover:text-gray-900 w-full">
              <LogOut size={16} /> Salir
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  )
}
