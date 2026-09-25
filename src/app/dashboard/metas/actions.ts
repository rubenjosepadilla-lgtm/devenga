'use server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export async function crearMeta(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) throw new Error('No autenticado')
  const tenantId = (session as any).tenantId as string | undefined
  if (!tenantId) throw new Error('Sin tenant')

  const sociedadId = formData.get('sociedad_id') as string | null

  await db.meta.create({
    data: {
      tenantId,
      sociedadId: sociedadId || undefined,
      nombre: formData.get('nombre') as string,
      tipo: formData.get('tipo') as string | undefined,
      valorObjetivo: formData.get('valor_objetivo') ? Number(formData.get('valor_objetivo')) : undefined,
      periodoInicio: formData.get('periodo_inicio') ? new Date(formData.get('periodo_inicio') as string) : undefined,
      periodoFin: formData.get('periodo_fin') ? new Date(formData.get('periodo_fin') as string) : undefined,
    },
  })

  revalidatePath('/dashboard/metas')
}
