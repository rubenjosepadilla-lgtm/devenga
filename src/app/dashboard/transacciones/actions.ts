'use server'
import { createClient } from '@/lib/supabase/server'
import { tenantDelUsuario } from '@/lib/datos/tenant'
import { revalidatePath } from 'next/cache'

export async function crearFuente(formData: FormData) {
  const supabase = await createClient()
  const ctx = await tenantDelUsuario()
  if (!ctx) throw new Error('Sin workspace activo')

  const { error } = await supabase.from('fuentes').insert({
    tenant_id: ctx.tenant.id_tenant,
    sociedad_id: formData.get('sociedad_id') as string,
    nombre: formData.get('nombre') as string,
    sistema_origen: (formData.get('sistema_origen') as string) || null,
    mapeo_campos: {},
  })

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/transacciones')
}

export async function cargaMasivaTransacciones(formData: FormData) {
  const supabase = await createClient()
  const ctx = await tenantDelUsuario()
  if (!ctx) throw new Error('Sin workspace activo')

  const sociedad_id = formData.get('sociedad_id') as string
  const fuente_id = (formData.get('fuente_id') as string) || null
  const filas = JSON.parse(formData.get('filas') as string) as {
    fecha_hecho: string; tipo_evento: string; monto: string; moneda: string; producto: string; canal: string
  }[]

  const rows = filas.map((f) => ({
    tenant_id: ctx.tenant.id_tenant,
    sociedad_id,
    fuente_id: fuente_id || null,
    fecha_hecho: f.fecha_hecho,
    tipo_evento: f.tipo_evento,
    monto: parseFloat(f.monto) || 0,
    moneda: f.moneda || 'CLP',
    producto: f.producto || null,
    canal: f.canal || null,
    estado: 'pendiente' as const,
  }))

  const { error } = await supabase.from('transacciones').insert(rows)
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/transacciones')
}

export async function resolverCuarentena(formData: FormData) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('transacciones_cuarentena')
    .update({ resuelta: true, resuelta_en: new Date().toISOString() })
    .eq('id', formData.get('id') as string)

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/transacciones')
}
