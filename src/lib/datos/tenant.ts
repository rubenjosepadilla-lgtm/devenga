import { createClient } from '@/lib/supabase/server'
import type { Tenant, RolBaseTenant } from '@/lib/dominio/tipos'

export interface TenantConRol {
  tenant: Tenant
  rol_base: RolBaseTenant
}

/**
 * Retorna el primer tenant activo del usuario autenticado.
 * En la fase actual cada usuario pertenece a un solo tenant.
 * Cuando admitamos multi-tenant, aquí se resolverá el tenant activo por sesión.
 */
export async function tenantDelUsuario(): Promise<TenantConRol | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('usuario_tenant')
    .select('rol_base, tenants(*)')
    .eq('usuario_id', user.id)
    .eq('activo', true)
    .limit(1)
    .single()

  if (!data || !data.tenants) return null

  return {
    tenant: data.tenants as unknown as Tenant,
    rol_base: data.rol_base as RolBaseTenant,
  }
}
