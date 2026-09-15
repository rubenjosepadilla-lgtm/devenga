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

// Autorizar y publicar viven en /api/campanas/[id]/{autorizar,publicar} — la
// publicación necesita simular el costo proyectado contra presupuesto_tope
// (§2.8 regla 4) y devolver un error estructurado que la UI pueda mostrar
// inline, algo que una server action no hace bien con `throw`.
