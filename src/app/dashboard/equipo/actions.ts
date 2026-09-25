'use server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export async function cambiarRol(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) throw new Error('No autenticado')
  const tenantId = (session as any).tenantId as string | undefined
  if (!tenantId) throw new Error('Sin tenant')

  await db.usuarioTenant.updateMany({
    where: {
      usuarioId: formData.get('usuario_id') as string,
      tenantId,
    },
    data: { rolBase: formData.get('rol_base') as string },
  })

  revalidatePath('/dashboard/equipo')
}

export async function toggleActivo(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) throw new Error('No autenticado')
  const tenantId = (session as any).tenantId as string | undefined
  if (!tenantId) throw new Error('Sin tenant')

  const activoActual = formData.get('activo') === 'true'
  await db.usuarioTenant.updateMany({
    where: {
      usuarioId: formData.get('usuario_id') as string,
      tenantId,
    },
    data: { activo: !activoActual },
  })

  revalidatePath('/dashboard/equipo')
}
