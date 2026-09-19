'use server'
import { createClient } from '@/lib/supabase/server'
import { tenantDelUsuario } from '@/lib/datos/tenant'
import { revalidatePath } from 'next/cache'

export async function cambiarRol(formData: FormData) {
  const supabase = await createClient()
  const ctx = await tenantDelUsuario()
  if (!ctx) throw new Error('Sin workspace activo')
  if (ctx.rol_base !== 'administrador') throw new Error('Solo administradores pueden cambiar roles')

  const usuario_id = formData.get('usuario_id') as string
  const nuevo_rol = formData.get('rol_base') as string

  const { error } = await supabase
    .from('usuario_tenant')
    .update({ rol_base: nuevo_rol })
    .eq('usuario_id', usuario_id)
    .eq('tenant_id', ctx.tenant.id_tenant)

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/equipo')
}

export async function toggleActivo(formData: FormData) {
  const supabase = await createClient()
  const ctx = await tenantDelUsuario()
  if (!ctx) throw new Error('Sin workspace activo')
  if (ctx.rol_base !== 'administrador') throw new Error('Solo administradores pueden cambiar estado')

  const usuario_id = formData.get('usuario_id') as string
  const activo = formData.get('activo') === 'true'

  const { error } = await supabase
    .from('usuario_tenant')
    .update({ activo: !activo })
    .eq('usuario_id', usuario_id)
    .eq('tenant_id', ctx.tenant.id_tenant)

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/equipo')
}
