'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function crearSociedad(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const { error } = await supabase.from('sociedades').insert({
    pais: formData.get('pais') as string,
    identificador_fiscal: formData.get('identificador_fiscal') as string,
    nombre: formData.get('nombre') as string,
    sistema_nomina: formData.get('sistema_nomina') as string,
    modo_integracion: formData.get('modo_integracion') as string,
    calendario_periodos: formData.get('calendario_periodos') as string,
    dia_corte_comisiones: Number(formData.get('dia_corte_comisiones')),
    responsable_aprobacion: formData.get('responsable_aprobacion') as string,
    creado_por: user.id,
  })

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/sociedades')
}
