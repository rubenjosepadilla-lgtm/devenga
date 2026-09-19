'use server'
import { createClient } from '@/lib/supabase/server'
import { tenantDelUsuario } from '@/lib/datos/tenant'
import { revalidatePath } from 'next/cache'

export async function crearPeriodo(formData: FormData) {
  const supabase = await createClient()
  const ctx = await tenantDelUsuario()
  if (!ctx) throw new Error('Sin workspace activo')

  const { error } = await supabase.from('periodos').insert({
    tenant_id: ctx.tenant.id_tenant,
    sociedad_id: formData.get('sociedad_id') as string,
    periodo: formData.get('periodo') as string,
  })

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/periodos')
}
