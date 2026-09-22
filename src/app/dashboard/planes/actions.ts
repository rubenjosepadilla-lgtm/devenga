'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function crearPlantilla(formData: FormData) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('crear_plantilla_plan', {
    p_sociedad_id: formData.get('sociedad_id') as string,
    p_pais: formData.get('pais') as string,
    p_nombre: formData.get('nombre') as string,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/planes')
}

export async function aprobarPlantilla(formData: FormData) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('aprobar_plantilla', {
    p_plantilla_id: formData.get('plantilla_id') as string,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/planes')
}

export async function crearAsignacion(formData: FormData) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('crear_asignacion_plan', {
    p_plantilla_id: formData.get('plantilla_id') as string,
    p_comisionado_id: formData.get('destino_id') as string,
    p_vigencia_desde: formData.get('vigencia_desde') as string,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/planes')
}

export async function crearComponente(formData: FormData) {
  const supabase = await createClient()
  const tasaTexto = formData.get('tasa') as string
  const { error } = await supabase.rpc('crear_componente_plan', {
    p_plantilla_id: formData.get('plantilla_id') as string,
    p_concepto_codigo: formData.get('concepto_codigo') as string,
    p_tipo: (formData.get('tipo') as string) || 'tasa_lineal',
    p_base_medicion: (formData.get('base_medicion') as string) || 'monto',
    p_orden_evaluacion: Number(formData.get('orden_evaluacion')) || 0,
    p_tasa: tasaTexto ? Number(tasaTexto) : null,
    p_regla_reparto: (formData.get('regla_reparto') as string) || null,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/planes')
}
