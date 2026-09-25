import { auth } from '@/auth'
import { NextResponse } from 'next/server'

export default auth(function middleware(req) {
  const { pathname } = req.nextUrl
  const session = req.auth

  if (pathname.startsWith('/dashboard') && !session) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  if (pathname.startsWith('/portal') && !pathname.startsWith('/portal/login') && !pathname.startsWith('/portal/register') && !session) {
    return NextResponse.redirect(new URL('/portal/login', req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/dashboard/:path*', '/portal/:path*'],
}
