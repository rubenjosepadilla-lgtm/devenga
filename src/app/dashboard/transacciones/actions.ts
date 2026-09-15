'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function crearFuente(formData: FormData) {
  const supabase = await createClient()

  const { error } = await supabase.from('fuentes').insert({
    sociedad_id: formData.get('sociedad_id') as string,
    sistema: formData.get('sistema') as string,
    modo: formData.get('modo') as string,
    politica_duplicados: formData.get('politica_duplicados') as string,
    ventana_aceptacion_dias: Number(formData.get('ventana_aceptacion_dias')) || 90,
  })

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/transacciones')
}

export async function resolverCuarentena(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const { error } = await supabase
    .from('transacciones_cuarentena')
    .update({ resuelto: true, resuelto_por: user.email, resuelto_en: new Date().toISOString() })
    .eq('id', formData.get('id') as string)

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/transacciones')
}
