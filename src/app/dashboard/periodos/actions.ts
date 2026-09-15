'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function crearPeriodo(formData: FormData) {
  const supabase = await createClient()

  const periodo = formData.get('periodo') as string
  const { error } = await supabase.from('periodos').insert({
    sociedad_id: formData.get('sociedad_id') as string,
    periodo,
    fecha_apertura: `${periodo}-01`,
    fecha_corte: formData.get('fecha_corte') as string,
  })

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/periodos')
}
