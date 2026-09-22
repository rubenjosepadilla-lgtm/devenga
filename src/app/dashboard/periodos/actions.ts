'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function crearPeriodo(formData: FormData) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('crear_periodo', {
    p_sociedad_id: formData.get('sociedad_id') as string,
    p_periodo: formData.get('periodo') as string,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/periodos')
}
