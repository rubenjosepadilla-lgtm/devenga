import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { calcularSlaVenceEn } from '@/lib/dominio/fase3/disputa'

const BodySchema = z.object({
  comisionado_id: z.string().uuid(),
  sociedad_id: z.string().uuid(),
  referencia_tipo: z.enum(['concepto', 'operacion']),
  referencia_id: z.string(),
  clasificacion: z.enum(['atribucion', 'monto', 'meta', 'campana', 'plan', 'pago']),
  descripcion: z.string().min(10),
})

/** §3.10 — apertura de disputa. El SLA se fija al abrir, según la clasificación. */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const parsed = BodySchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Payload inválido', detalle: parsed.error.flatten() }, { status: 400 })
  const body = parsed.data

  const slaVenceEn = calcularSlaVenceEn(body.clasificacion, new Date())

  const { data, error } = await supabase
    .from('disputas')
    .insert({ ...body, sla_vence_en: slaVenceEn.toISOString() })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ disputa: data }, { status: 201 })
}
