import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import type { NextAuthConfig } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      nombre: string
      tenantId: string | null
      rolBase: string | null
    }
  }
  interface User {
    id: string
    nombre: string
    tenantId?: string | null
    rolBase?: string | null
  }
}

const config: NextAuthConfig = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const email = credentials.email as string
        const password = credentials.password as string

        const usuario = await db.usuarios.findUnique({ where: { email } })
        if (!usuario || !usuario.password_hash) return null

        const valid = await bcrypt.compare(password, usuario.password_hash)
        if (!valid) return null

        const ut = await db.usuario_tenant.findFirst({
          where: { usuario_id: usuario.id, activo: true },
          orderBy: { created_at: 'asc' },
        })

        return {
          id: usuario.id,
          email: usuario.email,
          nombre: usuario.nombre,
          tenantId: ut?.tenant_id ?? null,
          rolBase: ut?.rol_base ?? null,
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.nombre = (user as any).nombre
        token.tenantId = (user as any).tenantId ?? null
        token.rolBase = (user as any).rolBase ?? null
      }
      return token
    },
    session({ session, token }) {
      session.user.id = token.id as string
      session.user.nombre = token.nombre as string
      session.user.tenantId = (token.tenantId as string | null) ?? null
      session.user.rolBase = (token.rolBase as string | null) ?? null
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
  session: { strategy: 'jwt' },
}

export const { handlers, auth, signIn, signOut } = NextAuth(config)
