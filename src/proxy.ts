import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isAuth = !!user
  const path = request.nextUrl.pathname
  const isPublic =
    path.startsWith('/login') || path.startsWith('/register') || path === '/' || path.startsWith('/api') ||
    path.startsWith('/portal/login') || path.startsWith('/portal/register')

  if (!isAuth && !isPublic) {
    // /documentos/[id] lo pueden ver tanto staff (redirige a /login) como
    // comisionados (redirige a /portal/login) — sin sesión, manda al genérico.
    const destino = path.startsWith('/portal') ? '/portal/login' : '/login'
    return NextResponse.redirect(new URL(destino, request.url))
  }
  if (isAuth && (path === '/login' || path === '/register')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }
  // No redirigimos usuarios autenticados fuera de /portal/login y /portal/register:
  // el staff puede necesitar ver el link del portal, y el portal layout
  // maneja el estado "no vinculado" sin redirect.

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
