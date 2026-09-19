'use server'
import { randomUUID } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { tenantDelUsuario } from '@/lib/datos/tenant'
import { revalidatePath } from 'next/cache'

/**
 * Crea el comisionado y su vínculo a una sociedad en la misma operación.
 * El id se genera aquí para evitar depender del RETURNING implícito tras el INSERT
 * (antes del vínculo, ninguna política RLS de SELECT aplica a la fila recién insertada).
 */
export async function crearComisionadoConVinculo(formData: FormData) {
  const supabase = await createClient()
  const ctx = await tenantDelUsuario()
  if (!ctx) throw new Error('Sin workspace activo')

  const pais = formData.get('pais') as string
  const identificador_personal = formData.get('identificador_personal') as string
  const tipo = formData.get('tipo') as string
  const vigencia_desde = formData.get('vigencia_desde') as string
  const sociedad_id = formData.get('sociedad_id') as string
  const id_en_nomina = formData.get('id_en_nomina') as string
  const centro_costo = (formData.get('centro_costo') as string) || null
  const rol_comercial = (formData.get('rol_comercial') as string) || null

  const id_comisionado = randomUUID()

  const { error: errorComisionado } = await supabase
    .from('comisionados')
    .insert({ id_comisionado, tenant_id: ctx.tenant.id_tenant, pais, identificador_personal, tipo, vigencia_desde })

  if (errorComisionado) throw new Error(errorComisionado.message)

  const { error: errorVinculo } = await supabase.from('comisionado_sociedad').insert({
    comisionado_id: id_comisionado,
    sociedad_id,
    desde: vigencia_desde,
    id_en_nomina,
    centro_costo,
    rol_comercial,
  })

  if (errorVinculo) {
    await supabase.from('comisionados').delete().eq('id_comisionado', id_comisionado)
    throw new Error(errorVinculo.message)
  }

  revalidatePath('/dashboard/comisionados')
}
