import { auth } from '@/auth'
import { db } from '@/lib/db'

export type SociedadResumen = {
  id_sociedad: string
  nombre: string
  pais: string
  tenant_id: string
}

export async function sociedadesDelUsuario(): Promise<SociedadResumen[]> {
  const session = await auth()
  const userId = session?.user?.id
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tenantId = (session as any)?.tenantId as string | undefined

  if (!userId || !tenantId) return []

  const ut = await db.usuarioTenant.findFirst({
    where: { usuarioId: userId, tenantId, activo: true },
  })
  if (!ut) return []

  if (ut.rolBase === 'administrador') {
    const sociedades = await db.sociedad.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    })
    return sociedades.map((s) => ({
      id_sociedad: s.idSociedad,
      nombre: s.nombre,
      pais: s.pais,
      tenant_id: s.tenantId,
    }))
  }

  const permisos = await db.usuarioPermisoSociedad.findMany({
    where: { usuarioId: userId },
    include: { sociedad: true },
  })
  const vistas = new Map<string, SociedadResumen>()
  for (const p of permisos) {
    if (!vistas.has(p.sociedadId)) {
      vistas.set(p.sociedadId, {
        id_sociedad: p.sociedad.idSociedad,
        nombre: p.sociedad.nombre,
        pais: p.sociedad.pais,
        tenant_id: p.sociedad.tenantId,
      })
    }
  }
  return Array.from(vistas.values())
}
