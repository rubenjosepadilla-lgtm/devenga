'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function crearCampana(formData: FormData) {
  const supabase = await createClient()

  const multiplicador = formData.get('multiplicador') as string
  const monto = formData.get('monto') as string

  const { error } = await supabase.from('campanas').insert({
    sociedad_id: formData.get('sociedad_id') as string,
    concepto_codigo: formData.get('concepto_codigo') as string,
    condicion: { tipo: formData.get('condicion_tipo') as string },
    multiplicador: multiplicador ? Number(multiplicador) : null,
    monto: monto ? Number(monto) : null,
    vigencia_hecho_desde: formData.get('vigencia_hecho_desde') as string,
    vigencia_hecho_hasta: formData.get('vigencia_hecho_hasta') as string,
    alcance_retroactivo: formData.get('alcance_retroactivo') as string,
    presupuesto_tope: Number(formData.get('presupuesto_tope')),
  })

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/campanas')
}

/** Puerta 3 (§4.1): autoriza una campaña en borrador. No la publica todavía. */
export async function autorizarCampana(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const { error } = await supabase
    .from('campanas')
    .update({
      estado: 'autorizada',
      autorizador: user.email,
      nivel_autorizacion: formData.get('nivel_autorizacion') as string,
      autorizado_en: new Date().toISOString(),
    })
    .eq('id_campana', formData.get('id_campana') as string)

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/campanas')
}

/** §2.8 regla 3: una campaña no autorizada no se publica; una no publicada no calcula. */
export async function publicarCampana(formData: FormData) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('campanas')
    .update({ estado: 'publicada', fecha_publicacion: new Date().toISOString().slice(0, 10) })
    .eq('id_campana', formData.get('id_campana') as string)
    .eq('estado', 'autorizada')

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/campanas')
}
