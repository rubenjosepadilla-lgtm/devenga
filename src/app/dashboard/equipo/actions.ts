'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function cambiarRol(formData: FormData) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('cambiar_rol_usuario', {
    p_usuario_id: formData.get('usuario_id') as string,
    p_rol_base: formData.get('rol_base') as string,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/equipo')
}

export async function toggleActivo(formData: FormData) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('toggle_activo_usuario', {
    p_usuario_id: formData.get('usuario_id') as string,
    p_activo_actual: formData.get('activo') === 'true',
  })
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/equipo')
}
