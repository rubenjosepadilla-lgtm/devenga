import { auth } from '@/auth'
import { db } from '@/lib/db'

export type TenantCtx = {
  tenant: { id_tenant: string; nombre_comercial: string; pais_base: string }
  rol_base: string
  usuario_id: string
}

export async function tenantDelUsuario(): Promise<TenantCtx | null> {
  const session = await auth()
  const userId = session?.user?.id
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tenantId = (session as any)?.tenantId as string | undefined

  if (!userId || !tenantId) return null

  const ut = await db.usuarioTenant.findFirst({
    where: { usuarioId: userId, tenantId, activo: true },
    include: { tenant: true },
  })
  if (!ut) return null

  return {
    tenant: {
      id_tenant: ut.tenant.idTenant,
      nombre_comercial: ut.tenant.nombreComercial,
      pais_base: ut.tenant.paisBase,
    },
    rol_base: ut.rolBase,
    usuario_id: userId,
  }
}
