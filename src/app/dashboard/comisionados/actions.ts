'use server'
import { randomUUID } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { tenantDelUsuario } from '@/lib/datos/tenant'
import { revalidatePath } from 'next/cache'

export async function crearComisionadoConVinculo(formData: FormData) {
  const supabase = await createClient()

  const pais = formData.get('pais') as string
  const identificador_personal = formData.get('identificador_personal') as string
  const tipo = formData.get('tipo') as string
  const vigencia_desde = formData.get('vigencia_desde') as string
  const sociedad_id = formData.get('sociedad_id') as string
  const id_en_nomina = formData.get('id_en_nomina') as string
  const centro_costo = (formData.get('centro_costo') as string) || null
  const rol_comercial = (formData.get('rol_comercial') as string) || null

  const { error } = await supabase.rpc('crear_comisionado_con_vinculo', {
    p_pais: pais,
    p_identificador_personal: identificador_personal,
    p_tipo: tipo,
    p_vigencia_desde: vigencia_desde,
    p_sociedad_id: sociedad_id,
    p_id_en_nomina: id_en_nomina,
    p_centro_costo: centro_costo,
    p_rol_comercial: rol_comercial,
  })

  if (error) throw new Error(error.message)

  revalidatePath('/dashboard/comisionados')
}

export async function cargaMasivaComisionados(formData: FormData) {
  const supabase = await createClient()
  const ctx = await tenantDelUsuario()
  if (!ctx) throw new Error('Sin workspace activo')

  const sociedad_id = formData.get('sociedad_id') as string
  const filas = JSON.parse(formData.get('filas') as string) as {
    pais: string; identificador_personal: string; tipo: string; vigencia_desde: string
    id_en_nomina: string; rol_comercial: string; centro_costo: string
  }[]

  for (const f of filas) {
    const id_comisionado = randomUUID()
    const { error: ec } = await supabase.from('comisionados').insert({
      id_comisionado,
      tenant_id: ctx.tenant.id_tenant,
      pais: f.pais,
      identificador_personal: f.identificador_personal,
      tipo: f.tipo || 'dependiente',
      vigencia_desde: f.vigencia_desde,
    })
    if (ec) continue // skip duplicados

    await supabase.from('comisionado_sociedad').insert({
      comisionado_id: id_comisionado,
      sociedad_id,
      desde: f.vigencia_desde,
      id_en_nomina: f.id_en_nomina || id_comisionado,
      rol_comercial: f.rol_comercial || null,
      centro_costo: f.centro_costo || null,
    })
  }

  revalidatePath('/dashboard/comisionados')
}
