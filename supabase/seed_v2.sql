-- Devenga v2 — Semilla global
-- Solo datos que no pertenecen a ningún tenant.
-- Los conceptos de comisiones se siembran por tenant en el onboarding.

-- ============================================================
-- PAÍSES
-- ============================================================
insert into paises (codigo_pais, nombre, moneda_funcional, estado) values
('CL', 'Chile',     'CLP', 'activo'),
('PE', 'Perú',      'PEN', 'activo'),
('CO', 'Colombia',  'COP', 'activo'),
('MX', 'México',    'MXN', 'activo'),
('AR', 'Argentina', 'ARS', 'activo');

-- ============================================================
-- PUERTAS DE APROBACIÓN (§4 del spec v2)
-- ============================================================
insert into puertas_aprobacion (numero, nombre, descripcion) values
(1, 'Diseño de plan',        'Diseñador crea/modifica la plantilla; estado → borrador'),
(2, 'Aprobación de plan',    'Aprobador valida y activa; estado → aprobado/vigente'),
(3, 'Carga de metas',        'Cargador sube magnitudes; estado → borrador/en_aprobacion'),
(4, 'Aprobación de metas',   'Aprobador ratifica; estado → vigente'),
(5, 'Autorización campaña',  'Aprobador de campaña; estado → autorizada → publicada');

-- ============================================================
-- CONTROLES BLOQUEANTES (§4 del spec v2)
-- ============================================================
insert into controles_bloqueantes (numero, nombre, descripcion) values
(1, 'Plan sin aprobar',      'No se puede cerrar período si hay plan en estado borrador vigente'),
(2, 'Meta sin vigente',      'No se puede calcular si no existe meta vigente para el período'),
(3, 'Campaña sin autorizar', 'No se puede publicar campaña sin autorización previa'),
(4, 'Transacción cuarentena','No se puede cerrar período con transacciones en cuarentena sin resolver'),
(5, 'Override sin aprobar',  'Override activo requiere aprobación antes del cierre');

-- ============================================================
-- SEGREGACIÓN DE FUNCIONES (§5 del spec v2)
-- ============================================================
insert into segregacion_funciones (rol_que_no_puede, accion_bloqueada, motivo) values
('carga_metas',     'aprueba_metas',     'El mismo usuario no puede cargar y aprobar sus propias metas'),
('disenador_planes','aprobador_planes',  'El diseñador de un plan no puede aprobarlo'),
('ingesta_transacciones', 'cierre_periodo', 'Quien ingesta no puede cerrar el período que calcula');
