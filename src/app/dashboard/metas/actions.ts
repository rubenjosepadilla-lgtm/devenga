'use server'
import { createClient } from '@/lib/supabase/server'
import { tenantDelUsuario } from '@/lib/datos/tenant'
import { revalidatePath } from 'next/cache'

export async function crearMeta(formData: FormData) {
  const supabase = await createClient()
  const ctx = await tenantDelUsuario()
  if (!ctx) throw new Error('Sin workspace activo')

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const { error } = await supabase.from('metas').insert({
    tenant_id: ctx.tenant.id_tenant,
    sociedad_id: formData.get('sociedad_id') as string,
    concepto_codigo: formData.get('concepto_codigo') as string,
    pais: formData.get('pais') as string,
    periodo: formData.get('periodo') as string,
    destino_tipo: formData.get('destino_tipo') as string,
    destino_id: formData.get('destino_id') as string,
    magnitud: Number(formData.get('magnitud')),
    unidad: (formData.get('unidad') as string) || 'CLP',
    cargada_por: user.id,
  })

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/metas')
}
