'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function crearMeta(formData: FormData) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('crear_meta', {
    p_sociedad_id: formData.get('sociedad_id') as string,
    p_concepto_codigo: formData.get('concepto_codigo') as string,
    p_pais: formData.get('pais') as string,
    p_periodo: formData.get('periodo') as string,
    p_destino_tipo: formData.get('destino_tipo') as string,
    p_destino_id: formData.get('destino_id') as string,
    p_magnitud: Number(formData.get('magnitud')),
    p_unidad: (formData.get('unidad') as string) || 'CLP',
  })
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/metas')
}
