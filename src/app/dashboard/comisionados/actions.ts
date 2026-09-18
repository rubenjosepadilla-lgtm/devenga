'use server'
import { randomUUID } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Crea el comisionado y su vínculo a una sociedad en la misma operación —
 * es el flujo normal descrito en §2.3: un comisionado nace ya vinculado a
 * quien lo va a comisionar.
 *
 * El id se genera acá en vez de leerlo de vuelta con `.select().single()`:
 * justo después del insert, el comisionado todavía no tiene vínculo a
 * ninguna sociedad, así que ninguna política de SELECT de `comisionados`
 * matchea esa fila todavía — Postgres reporta ese fallo del RETURNING
 * implícito como si fuera el propio insert ("new row violates row-level
 * security policy"). Generar el id de antemano evita depender de leerlo de vuelta.
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

  const id_comisionado = randomUUID()

  const { error: errorComisionado } = await supabase
    .from('comisionados')
    .insert({ id_comisionado, pais, identificador_personal, tipo, vigencia_desde })

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
    // Compensación: no dejar un comisionado huérfano sin vínculo a ninguna sociedad.
    await supabase.from('comisionados').delete().eq('id_comisionado', id_comisionado)
    throw new Error(errorVinculo.message)
  }

  revalidatePath('/dashboard/comisionados')
}
