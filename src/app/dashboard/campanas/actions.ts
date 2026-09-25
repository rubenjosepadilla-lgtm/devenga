'use server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export async function crearCampana(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) throw new Error('No autenticado')
  const tenantId = (session as any).tenantId as string | undefined
  if (!tenantId) throw new Error('Sin tenant')

  const sociedadId = formData.get('sociedad_id') as string | null
  const fechaInicio = formData.get('fecha_inicio') as string | null
  const fechaFin = formData.get('fecha_fin') as string | null

  await db.campana.create({
    data: {
      tenantId,
      sociedadId: sociedadId || undefined,
      nombre: formData.get('nombre') as string,
      descripcion: formData.get('descripcion') as string | undefined,
      fechaInicio: fechaInicio ? new Date(fechaInicio) : undefined,
      fechaFin: fechaFin ? new Date(fechaFin) : undefined,
      alcanceRetroactivo: formData.get('alcance_retroactivo') === 'true' ? 'todo_el_periodo_abierto' : 'desde_publicacion',
    },
  })

  revalidatePath('/dashboard/campanas')
}
