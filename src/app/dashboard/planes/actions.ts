'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function crearPlantilla(formData: FormData) {
  const supabase = await createClient()

  const { error } = await supabase.from('plantillas_plan').insert({
    sociedad_id: formData.get('sociedad_id') as string,
    nombre: formData.get('nombre') as string,
    pais: formData.get('pais') as string,
    periodicidad: formData.get('periodicidad') as string,
    moneda: formData.get('moneda') as string,
    vigencia_desde: formData.get('vigencia_desde') as string,
  })

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/planes')
}

export async function crearComponente(formData: FormData) {
  const supabase = await createClient()

  const tipo = formData.get('tipo') as string
  const tasaTexto = formData.get('tasa') as string

  const { error } = await supabase.from('componentes_plan').insert({
    plantilla_id: formData.get('plantilla_id') as string,
    tipo,
    concepto_codigo: formData.get('concepto_codigo') as string,
    base_medicion: formData.get('base_medicion') as string,
    orden_evaluacion: Number(formData.get('orden_evaluacion')),
    parametros: tasaTexto ? { tasa: Number(tasaTexto) } : {},
    regla_reparto: tipo === 'pool_equipo' ? (formData.get('regla_reparto') as string) : null,
  })

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/planes')
}
