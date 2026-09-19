export type CodigoPais = 'CL' | 'PE' | 'CO' | 'MX' | 'AR'

export const PAISES_V1: CodigoPais[] = ['CL', 'PE', 'CO', 'MX', 'AR']

export type Confianza = 'seguro' | 'probable' | 'suposicion'

export interface Fundamento {
  confianza: Confianza
  texto: string
  fuente?: string
}

// ============================================================
// TENANT
// ============================================================

export type EstadoTenant = 'en_configuracion' | 'activo' | 'suspendido' | 'baja'

export interface Tenant {
  id_tenant: string
  nombre_comercial: string
  dominio_personalizado: string | null
  logo_principal: string | null
  logo_reducido: string | null
  color_primario: string
  color_secundario: string
  color_acento: string
  tipografia: string | null
  pie_legal_email: string | null
  estado: EstadoTenant
  fecha_activacion: string | null
  pais_base: CodigoPais
  zona_horaria: string
  created_at: string
}

// ============================================================
// RBAC
// ============================================================

export type RolBaseTenant = 'administrador' | 'jefe' | 'comisionado'

export type PermisoOperacional =
  | 'admin_sociedad'
  | 'carga_metas'
  | 'aprueba_metas'
  | 'disenador_planes'
  | 'aprobador_planes'
  | 'ingesta_transacciones'
  | 'cierre_periodo'
  | 'aprobador_campanas'
  | 'jefatura_comercial'

export interface UsuarioTenant {
  id: string
  usuario_id: string
  tenant_id: string
  rol_base: RolBaseTenant
  activo: boolean
  created_at: string
}

// ============================================================
// SOCIEDAD
// ============================================================

export interface Sociedad {
  id_sociedad: string
  tenant_id: string
  pais: CodigoPais
  nombre: string
  identificador_fiscal: string | null
  sistema_nomina: string | null
  modo_integracion: 'api' | 'archivo' | 'manual'
  created_at: string
}

export interface SociedadResumen {
  id_sociedad: string
  tenant_id: string
  nombre: string
  pais: CodigoPais
  rol_base: RolBaseTenant
}

// ============================================================
// COMISIONADO
// ============================================================

export interface Comisionado {
  id_comisionado: string
  tenant_id: string
  pais: CodigoPais
  identificador_personal: string
  tipo: 'dependiente' | 'no_dependiente'
  vigencia_desde: string
  usuario_id: string | null
  created_at: string
}
