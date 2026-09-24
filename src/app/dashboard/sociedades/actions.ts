'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function crearSociedad(formData: FormData) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('crear_sociedad', {
    p_pais: formData.get('pais') as string,
    p_identificador_fiscal: formData.get('identificador_fiscal') as string,
    p_nombre: formData.get('nombre') as string,
    p_sistema_nomina: formData.get('sistema_nomina') as string,
    p_modo_integracion: (formData.get('modo_integracion') as string) || 'manual',
  })
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/sociedades')
}
