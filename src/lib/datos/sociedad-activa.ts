import { createClient } from '@/lib/supabase/server'
import type { SociedadResumen } from '@/lib/dominio/tipos'

export type { SociedadResumen }

/**
 * Sociedades del tenant al que pertenece el usuario autenticado.
 * En v2 el acceso se basa en tenant_id (administrador ve todas)
 * o en permisos operacionales explícitos.
 */
export async function sociedadesDelUsuario(): Promise<SociedadResumen[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('sociedades')
    .select('id_sociedad, tenant_id, nombre, pais')
    .order('nombre')

  if (!data) return []

  return data.map((s) => ({
    id_sociedad: s.id_sociedad,
    tenant_id: s.tenant_id,
    nombre: s.nombre,
    pais: s.pais,
    rol_base: 'administrador' as const,
  }))
}

export function resolverSociedadActiva(
  sociedades: SociedadResumen[],
  solicitada?: string,
): SociedadResumen | undefined {
  if (solicitada) {
    const encontrada = sociedades.find((s) => s.id_sociedad === solicitada)
    if (encontrada) return encontrada
  }
  return sociedades[0]
}
