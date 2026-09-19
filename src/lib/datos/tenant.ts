import { createClient } from '@/lib/supabase/server'
import type { Tenant, RolBaseTenant } from '@/lib/dominio/tipos'

export interface TenantConRol {
  tenant: Tenant
  rol_base: RolBaseTenant
}

/**
 * Retorna el primer tenant activo del usuario autenticado.
 * Usa dos queries separadas para evitar depender del join relacional de PostgREST.
 */
export async function tenantDelUsuario(): Promise<TenantConRol | null> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data: membership, error: errMembr } = await supabase
      .from('usuario_tenant')
      .select('tenant_id, rol_base')
      .eq('usuario_id', user.id)
      .eq('activo', true)
      .limit(1)
      .maybeSingle()

    if (errMembr || !membership) return null

    const { data: tenant, error: errTenant } = await supabase
      .from('tenants')
      .select('*')
      .eq('id_tenant', membership.tenant_id)
      .maybeSingle()

    if (errTenant || !tenant) return null

    return {
      tenant: tenant as unknown as Tenant,
      rol_base: membership.rol_base as RolBaseTenant,
    }
  } catch {
    return null
  }
}
