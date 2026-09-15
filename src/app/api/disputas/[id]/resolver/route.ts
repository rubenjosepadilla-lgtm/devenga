import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const BodySchema = z.object({
  aceptar: z.boolean(),
  motivo_resolucion: z.string().min(10),
  genera_ajuste: z.boolean().default(false),
})

/**
 * §3.10 — resolución con motivo. Si `genera_ajuste`, esto solo deja la
 * marca; la generación del movimiento de ajuste en sí es manual (crear la
 * corrección desde el período correspondiente, §3.11) — no está automatizada
 * todavía.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const parsed = BodySchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Payload inválido', detalle: parsed.error.flatten() }, { status: 400 })
  const { aceptar, motivo_resolucion, genera_ajuste } = parsed.data

  const { error } = await supabase
    .from('disputas')
    .update({
      estado: aceptar ? 'resuelta' : 'rechazada',
      motivo_resolucion,
      genera_ajuste: aceptar ? genera_ajuste : false,
      resuelta_por: user.email,
      resuelta_en: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 409 })
  return NextResponse.json({ estado: aceptar ? 'resuelta' : 'rechazada' })
}
