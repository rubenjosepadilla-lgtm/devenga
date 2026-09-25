'use server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export async function crearSociedad(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) throw new Error('No autenticado')

  const tenantId = (session as any).tenantId as string | undefined
  if (!tenantId) throw new Error('Sin tenant activo')

  await db.sociedad.create({
    data: {
      tenantId,
      pais: formData.get('pais') as string,
      nombre: formData.get('nombre') as string,
    },
  })

  revalidatePath('/dashboard/sociedades')
}
