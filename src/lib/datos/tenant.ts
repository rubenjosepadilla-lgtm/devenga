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

    const { data, error } = await supabase.rpc('obtener_mi_tenant')
    if (error || !data) return null

    const row = data as Record<string, unknown>
    return {
      tenant: {
        id_tenant: row.id_tenant,
        nombre_comercial: row.nombre_comercial,
        pais_base: row.pais_base,
        dominio_personalizado: row.dominio_personalizado ?? null,
        logo_principal: row.logo_principal ?? null,
        color_primario: row.color_primario ?? null,
      } as Tenant,
      rol_base: row.rol_base as RolBaseTenant,
    }
  } catch {
    return null
  }
}
