import { NextRequest, NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  const { nombre, email, password } = await req.json()

  if (!email || !password || password.length < 8) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  const existe = await db.usuario.findUnique({ where: { email } })
  if (existe) {
    return NextResponse.json({ error: 'Ya existe una cuenta con ese email' }, { status: 409 })
  }

  const passwordHash = await hash(password, 12)
  await db.usuario.create({
    data: { email, passwordHash, nombre: nombre ?? '' },
  })

  return NextResponse.json({ ok: true }, { status: 201 })
}
