'use server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function crearWorkspace(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const nombre_comercial = (formData.get('nombre_comercial') as string).trim()
  const pais_base = formData.get('pais_base') as string

  if (!nombre_comercial || !pais_base) throw new Error('Faltan campos obligatorios')

  // Crear tenant + membresía vía función SECURITY DEFINER (bypassa RLS)
  const { data: tenantId, error: errorFn } = await supabase
    .rpc('crear_tenant_inicial', {
      p_nombre_comercial: nombre_comercial,
      p_pais_base: pais_base,
    })

  if (errorFn || !tenantId) throw new Error(errorFn?.message ?? 'Error al crear workspace')

  // Sembrar conceptos base del país seleccionado para este tenant
  await sembrarConceptosPais(supabase, tenantId as string, pais_base)

  redirect('/dashboard')
}

// Conceptos estándar por país — se copian a cada nuevo tenant
async function sembrarConceptosPais(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  tenant_id: string,
  pais: string,
) {
  const hoy = new Date().toISOString().slice(0, 10)
  const conceptosPorPais: Record<string, { codigo: string; nombre: string; tipo: string; devengo_diario: boolean; evento_devengo: string; incide_en: string[]; principalidad: string; ordinariedad: string }[]> = {
    CL: [
      { codigo: 'COM-VENTA', nombre: 'Comisión por venta individual', tipo: 'comision', devengo_diario: true, evento_devengo: 'facturacion', incide_en: ['semana_corrida','gratificacion','feriado','indemnizaciones','base_imponible'], principalidad: 'principal', ordinariedad: 'ordinario' },
      { codigo: 'PREMIO-META', nombre: 'Premio mensual por meta grupal', tipo: 'bono_meta', devengo_diario: false, evento_devengo: 'cierre_mes', incide_en: ['gratificacion','base_imponible'], principalidad: 'accesorio', ordinariedad: 'extraordinario' },
    ],
    PE: [
      { codigo: 'COM-PRINCIPAL', nombre: 'Comisión remuneración principal', tipo: 'comision', devengo_diario: true, evento_devengo: 'facturacion', incide_en: ['cts','gratificaciones','vacaciones','cts_al_cese'], principalidad: 'principal', ordinariedad: 'ordinario' },
    ],
    CO: [
      { codigo: 'COM-VENTA', nombre: 'Comisión sobre ventas (art. 127 CST)', tipo: 'comision', devengo_diario: true, evento_devengo: 'facturacion', incide_en: ['prima','cesantias','intereses_cesantias','vacaciones','ibc','indemnizacion'], principalidad: 'principal', ordinariedad: 'ordinario' },
    ],
    MX: [
      { codigo: 'COM-VENTA', nombre: 'Comisión sobre ventas (SBC variable)', tipo: 'comision', devengo_diario: true, evento_devengo: 'facturacion', incide_en: ['sbc_imss','aguinaldo','prima_vacacional','indemnizacion'], principalidad: 'principal', ordinariedad: 'ordinario' },
    ],
    AR: [
      { codigo: 'COM-VENTA', nombre: 'Comisión sobre ventas', tipo: 'comision', devengo_diario: true, evento_devengo: 'facturacion', incide_en: ['sac','vacaciones','indemnizacion'], principalidad: 'principal', ordinariedad: 'ordinario' },
    ],
  }

  const plantillas = conceptosPorPais[pais] ?? []
  if (plantillas.length === 0) return

  await supabase.from('conceptos').insert(
    plantillas.map((c) => ({
      tenant_id,
      pais,
      codigo: `${pais}-${c.codigo}`,
      nombre: c.nombre,
      tipo: c.tipo,
      devengo_diario: c.devengo_diario,
      evento_devengo: c.evento_devengo,
      incide_en: c.incide_en,
      principalidad: c.principalidad,
      ordinariedad: c.ordinariedad,
      vigencia_desde: hoy,
    })),
  )
}
