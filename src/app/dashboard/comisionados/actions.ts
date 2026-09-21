'use server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function crearComisionadoConVinculo(formData: FormData) {
  const supabase = await createClient()
  const admin = createAdminClient()

  const pais = formData.get('pais') as string
  const identificador_personal = formData.get('identificador_personal') as string
  const tipo = formData.get('tipo') as string
  const vigencia_desde = formData.get('vigencia_desde') as string
  const sociedad_id = formData.get('sociedad_id') as string
  const id_en_nomina = formData.get('id_en_nomina') as string
  const centro_costo = (formData.get('centro_costo') as string) || null
  const rol_comercial = (formData.get('rol_comercial') as string) || null
  const email = (formData.get('email') as string) || null

  // Si se proporcionó email, invitar al usuario y obtener su user_id
  let usuario_id: string | null = null
  if (email) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://devenga.vercel.app'
    const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${appUrl}/portal`,
    })
    if (inviteError) {
      // Si ya existe, buscar el user_id por email en lugar de fallar
      if (inviteError.message.toLowerCase().includes('already') || inviteError.status === 422) {
        const { data: listData } = await admin.auth.admin.listUsers()
        const existing = listData?.users?.find((u) => u.email === email)
        if (existing) usuario_id = existing.id
        // Si no encontramos el usuario existente, continuamos sin vincular
      } else {
        throw new Error(`Error al invitar usuario: ${inviteError.message}`)
      }
    } else {
      usuario_id = inviteData.user.id
    }
  }

  const { error } = await supabase.rpc('crear_comisionado_con_vinculo', {
    p_pais: pais,
    p_identificador_personal: identificador_personal,
    p_tipo: tipo,
    p_vigencia_desde: vigencia_desde,
    p_sociedad_id: sociedad_id,
    p_id_en_nomina: id_en_nomina,
    p_centro_costo: centro_costo,
    p_rol_comercial: rol_comercial,
    p_usuario_id: usuario_id,
  })

  if (error) throw new Error(error.message)

  revalidatePath('/dashboard/comisionados')
}

export async function cargaMasivaComisionados(formData: FormData) {
  const supabase = await createClient()
  const admin = createAdminClient()

  const sociedad_id = formData.get('sociedad_id') as string
  const filas = JSON.parse(formData.get('filas') as string) as {
    pais: string; identificador_personal: string; tipo: string; vigencia_desde: string
    id_en_nomina: string; rol_comercial: string; centro_costo: string; email?: string
  }[]

  for (const f of filas) {
    let usuario_id: string | null = null
    if (f.email) {
      const { data } = await admin.auth.admin.inviteUserByEmail(f.email, {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/portal`,
      })
      usuario_id = data?.user?.id ?? null
    }

    await supabase.rpc('crear_comisionado_con_vinculo', {
      p_pais: f.pais,
      p_identificador_personal: f.identificador_personal,
      p_tipo: f.tipo || 'dependiente',
      p_vigencia_desde: f.vigencia_desde,
      p_sociedad_id: sociedad_id,
      p_id_en_nomina: f.id_en_nomina,
      p_centro_costo: f.centro_costo || null,
      p_rol_comercial: f.rol_comercial || null,
      p_usuario_id: usuario_id,
    })
  }

  revalidatePath('/dashboard/comisionados')
}
