'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function crearMeta(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const { error } = await supabase.from('metas').insert({
    sociedad_id: formData.get('sociedad_id') as string,
    destino_tipo: formData.get('destino_tipo') as string,
    destino_id: formData.get('destino_id') as string,
    periodo: formData.get('periodo') as string,
    magnitud: Number(formData.get('magnitud')),
    unidad: formData.get('unidad') as string,
    cargada_por: user.email ?? user.id,
  })

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/metas')
}
