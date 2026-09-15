'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Crea el comisionado y su vínculo a una sociedad en la misma operación —
 * es el flujo normal descrito en §2.3: un comisionado nace ya vinculado a
 * quien lo va a comisionar.
 */
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

  const { data: comisionado, error: errorComisionado } = await supabase
    .from('comisionados')
    .insert({ pais, identificador_personal, tipo, vigencia_desde })
    .select()
    .single()

  if (errorComisionado) throw new Error(errorComisionado.message)

  const { error: errorVinculo } = await supabase.from('comisionado_sociedad').insert({
    comisionado_id: comisionado.id_comisionado,
    sociedad_id,
    desde: vigencia_desde,
    id_en_nomina,
    centro_costo,
    rol_comercial,
  })

  if (errorVinculo) throw new Error(errorVinculo.message)
  revalidatePath('/dashboard/comisionados')
}
