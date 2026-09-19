'use server'
import { createClient } from '@/lib/supabase/server'
import { tenantDelUsuario } from '@/lib/datos/tenant'
import { revalidatePath } from 'next/cache'

export async function crearPlantilla(formData: FormData) {
  const supabase = await createClient()
  const ctx = await tenantDelUsuario()
  if (!ctx) throw new Error('Sin workspace activo')

  const { error } = await supabase.from('plantillas_plan').insert({
    tenant_id: ctx.tenant.id_tenant,
    sociedad_id: formData.get('sociedad_id') as string,
    pais: formData.get('pais') as string,
    nombre: formData.get('nombre') as string,
  })

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/planes')
}

export async function aprobarPlantilla(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const { error } = await supabase
    .from('plantillas_plan')
    .update({ estado: 'aprobado', aprobado_por: user.id, aprobado_en: new Date().toISOString() })
    .eq('id_plantilla', formData.get('plantilla_id') as string)

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/planes')
}

export async function crearAsignacion(formData: FormData) {
  const supabase = await createClient()

  const { error } = await supabase.from('asignaciones_plan').insert({
    plantilla_id: formData.get('plantilla_id') as string,
    comisionado_id: formData.get('comisionado_id') as string,
    vigencia_desde: formData.get('vigencia_desde') as string,
  })

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/planes')
}

export async function crearComponente(formData: FormData) {
  const supabase = await createClient()

  const tasaTexto = formData.get('tasa') as string

  const { error } = await supabase.from('componentes_plan').insert({
    plantilla_id: formData.get('plantilla_id') as string,
    concepto_codigo: formData.get('concepto_codigo') as string,
    tipo_calculo: (formData.get('tipo_calculo') as string) || 'tasa_lineal',
    parametros: tasaTexto ? { tasa: Number(tasaTexto) } : {},
    orden: Number(formData.get('orden')) || 0,
  })

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/planes')
}
