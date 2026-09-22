'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function crearFuente(formData: FormData) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('crear_fuente', {
    p_sociedad_id: formData.get('sociedad_id') as string,
    p_nombre: formData.get('nombre') as string,
    p_sistema_origen: (formData.get('sistema_origen') as string) || null,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/transacciones')
}

export async function cargaMasivaTransacciones(formData: FormData) {
  const supabase = await createClient()
  const sociedad_id = formData.get('sociedad_id') as string
  const fuente_id = (formData.get('fuente_id') as string) || null
  const filas = JSON.parse(formData.get('filas') as string) as {
    fecha_hecho: string; tipo_evento: string; monto: string; moneda: string; producto: string; canal: string
  }[]

  const { error } = await supabase.rpc('cargar_transacciones_masivo', {
    p_sociedad_id: sociedad_id,
    p_fuente_id: fuente_id,
    p_filas: filas,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/transacciones')
}

export async function resolverCuarentena(formData: FormData) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('resolver_cuarentena', {
    p_cuarentena_id: formData.get('id') as string,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/transacciones')
}
