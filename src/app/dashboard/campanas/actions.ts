'use server'
import { createClient } from '@/lib/supabase/server'
import { tenantDelUsuario } from '@/lib/datos/tenant'
import { revalidatePath } from 'next/cache'

export async function crearCampana(formData: FormData) {
  const supabase = await createClient()
  const ctx = await tenantDelUsuario()
  if (!ctx) throw new Error('Sin workspace activo')

  const multiplicador = formData.get('multiplicador') as string
  const monto = formData.get('monto') as string
  const presupuesto = formData.get('presupuesto_tope') as string

  const { error } = await supabase.from('campanas').insert({
    tenant_id: ctx.tenant.id_tenant,
    sociedad_id: formData.get('sociedad_id') as string,
    concepto_codigo: formData.get('concepto_codigo') as string,
    nombre: formData.get('nombre') as string,
    tipo: formData.get('tipo') as string,
    multiplicador: multiplicador ? Number(multiplicador) : null,
    monto: monto ? Number(monto) : null,
    vigencia_hecho_desde: formData.get('vigencia_hecho_desde') as string,
    vigencia_hecho_hasta: formData.get('vigencia_hecho_hasta') as string,
    alcance_retroactivo: formData.get('alcance_retroactivo') === 'true',
    presupuesto_tope: presupuesto ? Number(presupuesto) : null,
  })

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/campanas')
}
