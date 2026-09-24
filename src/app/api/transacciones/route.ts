import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { procesarIngesta } from '@/lib/motor/ingesta'

/**
 * §3.8/§6 — ingesta de transacciones comisionables. Un solo contrato de
 * datos, válido tanto si lo llama un integrador por API como si la UI de
 * carga manual termina llamando a este mismo endpoint.
 */

const MONEDAS_CONOCIDAS = new Set(['CLP', 'PEN', 'COP', 'MXN', 'ARS'])

const SplitSchema = z.object({
  comisionado_id: z.string().uuid(),
  porcentaje: z.number().positive().max(100),
})

const TransaccionSchema = z.object({
  id_externo: z.string().optional(),
  fuente_id: z.string().uuid(),
  sociedad_id: z.string().uuid(),
  pais: z.enum(['CL', 'PE', 'CO', 'MX', 'AR']),
  fecha_hecho: z.string(),
  fecha_credito: z.string().optional(),
  tipo_evento: z.enum(['firma', 'despacho', 'factura', 'cobro', 'nota_credito']),
  cliente: z.string().optional(),
  producto: z.string().optional(),
  canal: z.string().optional(),
  territorio: z.string().optional(),
  monto_bruto: z.number(),
  monto_neto: z.number().optional(),
  margen: z.number().optional(),
  unidades: z.number().optional(),
  moneda: z.string(),
  clave_natural: z.string(),
})

const BodySchema = z.object({
  transaccion: TransaccionSchema,
  splits: z.array(SplitSchema).min(1),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const parsed = BodySchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Payload inválido', detalle: parsed.error.flatten() }, { status: 400 })
  }
  const { transaccion, splits } = parsed.data

  const { data: fuente, error: errorFuente } = await supabase
    .from('fuentes')
    .select('*')
    .eq('id_fuente', transaccion.fuente_id)
    .single()
  if (errorFuente || !fuente) return NextResponse.json({ error: 'Fuente no encontrada' }, { status: 404 })

  const { data: existente } = await supabase
    .from('transacciones')
    .select('id_transaccion, clave_natural')
    .eq('fuente_id', transaccion.fuente_id)
    .like('clave_natural', `${transaccion.clave_natural}%`)

  const existeExacto = (existente ?? []).some((e) => e.clave_natural === transaccion.clave_natural)

  const idsComisionados = splits.map((s) => s.comisionado_id)
  const { data: vinculos } = await supabase
    .from('comisionado_sociedad')
    .select('comisionado_id, desde, hasta')
    .in('comisionado_id', idsComisionados)
    .eq('sociedad_id', transaccion.sociedad_id)

  const comisionadoVigente = (comisionadoId: string, fecha: string) =>
    (vinculos ?? []).some((v) => v.comisionado_id === comisionadoId && v.desde <= fecha && (!v.hasta || v.hasta >= fecha))

  const hashOrigen = randomUUID()
  const transaccionCompleta = { ...transaccion, hash_origen: hashOrigen, estado: 'valida' as const }

  const resultado = procesarIngesta({
    transaccion: transaccionCompleta,
    splits,
    fuente,
    existeDuplicado: existeExacto,
    comisionadoVigente,
    monedaConocida: (m) => MONEDAS_CONOCIDAS.has(m),
    hoy: new Date().toISOString().slice(0, 10),
  })

  if (resultado.tipo === 'duplicado_rechazado') {
    return NextResponse.json({ error: 'Duplicado — política de la fuente es rechazar' }, { status: 409 })
  }

  if (resultado.tipo === 'cuarentena') {
    const { error } = await supabase.from('transacciones_cuarentena').insert({
      fuente_id: resultado.registro.fuente_id,
      payload: resultado.registro.payload as object,
      motivo: resultado.registro.motivo,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ estado: 'cuarentena', motivo: resultado.registro.motivo }, { status: 202 })
  }

  let claveNatural = transaccion.clave_natural
  if (resultado.tipo === 'duplicado_versiona') {
    const versiones = (existente ?? []).filter((e) => e.clave_natural.startsWith(`${transaccion.clave_natural}::v`)).length
    claveNatural = `${transaccion.clave_natural}::v${versiones + 2}`
  }

  if (resultado.tipo === 'duplicado_actualiza') {
    const { data: fila, error: errorUpdate } = await supabase
      .from('transacciones')
      .update(transaccionCompleta)
      .eq('fuente_id', transaccion.fuente_id)
      .eq('clave_natural', transaccion.clave_natural)
      .select('id_transaccion')
      .single()
    if (errorUpdate || !fila) return NextResponse.json({ error: errorUpdate?.message ?? 'no encontrada' }, { status: 500 })

    await supabase.from('transaccion_splits').delete().eq('transaccion_id', fila.id_transaccion)
    const { error: errorSplits } = await supabase
      .from('transaccion_splits')
      .insert(splits.map((s) => ({ transaccion_id: fila.id_transaccion, ...s })))
    if (errorSplits) return NextResponse.json({ error: errorSplits.message }, { status: 500 })

    return NextResponse.json({ estado: 'actualizada', id_transaccion: fila.id_transaccion })
  }

  // 'aceptada' o 'duplicado_versiona' — insertar como transacción nueva.
  const { data: fila, error: errorInsert } = await supabase
    .from('transacciones')
    .insert({ ...transaccionCompleta, clave_natural: claveNatural })
    .select('id_transaccion')
    .single()
  if (errorInsert || !fila) return NextResponse.json({ error: errorInsert?.message ?? 'error desconocido' }, { status: 500 })

  const { error: errorSplits } = await supabase
    .from('transaccion_splits')
    .insert(splits.map((s) => ({ transaccion_id: fila.id_transaccion, ...s })))
  if (errorSplits) {
    // Compensación: no dejar una transacción huérfana sin splits.
    await supabase.from('transacciones').delete().eq('id_transaccion', fila.id_transaccion)
    return NextResponse.json({ error: errorSplits.message }, { status: 500 })
  }

  return NextResponse.json({ estado: resultado.tipo, id_transaccion: fila.id_transaccion }, { status: 201 })
}
