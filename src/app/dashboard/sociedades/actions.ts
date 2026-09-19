'use server'
import { createClient } from '@/lib/supabase/server'
import { tenantDelUsuario } from '@/lib/datos/tenant'
import { revalidatePath } from 'next/cache'

export async function crearSociedad(formData: FormData) {
  const supabase = await createClient()
  const ctx = await tenantDelUsuario()
  if (!ctx) throw new Error('Sin workspace activo')

  const { error } = await supabase.from('sociedades').insert({
    tenant_id: ctx.tenant.id_tenant,
    pais: formData.get('pais') as string,
    identificador_fiscal: formData.get('identificador_fiscal') as string,
    nombre: formData.get('nombre') as string,
    sistema_nomina: formData.get('sistema_nomina') as string,
    modo_integracion: (formData.get('modo_integracion') as string) || 'manual',
  })

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/sociedades')
}
