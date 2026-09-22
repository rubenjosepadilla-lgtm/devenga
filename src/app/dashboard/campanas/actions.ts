'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function crearCampana(formData: FormData) {
  const supabase = await createClient()
  const multiplicador = formData.get('multiplicador') as string
  const monto = formData.get('monto') as string
  const presupuesto = formData.get('presupuesto_tope') as string

  const { error } = await supabase.rpc('crear_campana', {
    p_sociedad_id: formData.get('sociedad_id') as string,
    p_concepto_codigo: formData.get('concepto_codigo') as string,
    p_nombre: formData.get('nombre') as string,
    p_tipo: formData.get('tipo') as string,
    p_multiplicador: multiplicador ? Number(multiplicador) : null,
    p_monto: monto ? Number(monto) : null,
    p_vigencia_hecho_desde: formData.get('vigencia_hecho_desde') as string,
    p_vigencia_hecho_hasta: formData.get('vigencia_hecho_hasta') as string,
    p_alcance_retroactivo: formData.get('alcance_retroactivo') === 'true' ? 'todo_el_periodo_abierto' : 'desde_publicacion',
    p_presupuesto_tope: presupuesto ? Number(presupuesto) : null,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/campanas')
}
