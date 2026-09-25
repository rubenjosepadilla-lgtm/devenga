'use server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export async function crearPlantilla(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) throw new Error('No autenticado')
  const tenantId = (session as any).tenantId as string | undefined
  if (!tenantId) throw new Error('Sin tenant')

  const sociedadId = formData.get('sociedad_id') as string | null

  await db.plantillaPlan.create({
    data: {
      tenantId,
      sociedadId: sociedadId || undefined,
      nombre: formData.get('nombre') as string,
      descripcion: formData.get('descripcion') as string | undefined,
    },
  })

  revalidatePath('/dashboard/planes')
}

export async function crearAsignacion(formData: FormData) {
  const plantillaPlanId = formData.get('plantilla_id') as string
  const comisionadoId = formData.get('comisionado_id') as string
  const vigenciaDesde = formData.get('vigencia_desde') as string

  await db.asignacionPlan.create({
    data: {
      plantillaPlanId,
      comisionadoId,
      vigenteDesdde: new Date(vigenciaDesde),
    },
  })

  revalidatePath('/dashboard/planes')
}

export async function crearComponente(formData: FormData) {
  const plantillaPlanId = formData.get('plantilla_id') as string
  const tasaTexto = formData.get('tasa') as string
  const tipo = (formData.get('tipo') as string) || 'tasa_lineal'
  const tasa = tasaTexto ? Number(tasaTexto) : null

  await db.componentePlan.create({
    data: {
      plantillaPlanId,
      nombre: formData.get('nombre') as string,
      tipo,
      parametros: tasa ? { tasa } : undefined,
      orden: Number(formData.get('orden')) || 0,
    },
  })

  revalidatePath('/dashboard/planes')
}
