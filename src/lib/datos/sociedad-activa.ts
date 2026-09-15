import { createClient } from '@/lib/supabase/server'

export interface SociedadResumen {
  id_sociedad: string
  nombre: string
  pais: string
  rol: string
}

/**
 * Sociedades a las que el usuario autenticado pertenece (vía usuario_rol_sociedad),
 * usado por el layout del dashboard para el selector de sociedad activa.
 */
export async function sociedadesDelUsuario(): Promise<SociedadResumen[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('usuario_rol_sociedad')
    .select('rol, sociedades(id_sociedad, nombre, pais)')
    .eq('usuario_id', user.id)

  if (!data) return []

  // Un usuario puede tener varios roles en la misma sociedad: se deduplica por id_sociedad.
  const vistos = new Map<string, SociedadResumen>()
  for (const fila of data as unknown as { rol: string; sociedades: { id_sociedad: string; nombre: string; pais: string } | null }[]) {
    if (!fila.sociedades) continue
    if (!vistos.has(fila.sociedades.id_sociedad)) {
      vistos.set(fila.sociedades.id_sociedad, { ...fila.sociedades, rol: fila.rol })
    }
  }
  return Array.from(vistos.values())
}

/** Resuelve la sociedad activa: la pedida por query param si el usuario pertenece a ella, si no la primera. */
export function resolverSociedadActiva(sociedades: SociedadResumen[], solicitada?: string): SociedadResumen | undefined {
  if (solicitada) {
    const encontrada = sociedades.find((s) => s.id_sociedad === solicitada)
    if (encontrada) return encontrada
  }
  return sociedades[0]
}
