'use server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'

export async function crearWorkspace(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  const userId = session.user.id

  const nombreComercial = (formData.get('nombre_comercial') as string).trim()
  const paisBase = formData.get('pais_base') as string

  if (!nombreComercial || !paisBase) throw new Error('Faltan campos obligatorios')

  const tenant = await db.tenant.create({
    data: { nombreComercial, paisBase },
  })

  await db.usuarioTenant.create({
    data: {
      usuarioId: userId,
      tenantId: tenant.idTenant,
      rolBase: 'administrador',
      activo: true,
    },
  })

  redirect('/dashboard')
}
