# Análisis de brechas funcionales — Devenga vs SAP Commissions
*Fecha: 19-sep-2026 | Base de comparación: SAP Commissions (ex-Callidus Cloud)*

---

## Contexto

Este documento identifica las brechas funcionales entre Devenga y SAP Commissions, el estándar de mercado enterprise para gestión de comisiones de ventas. El objetivo es priorizar el roadmap de Devenga para alcanzar paridad competitiva en el segmento mid-market LATAM, donde el argumento de precio + normativa laboral nativa es el diferenciador central.

---

## Estado actual de Devenga (implementado)

| Módulo | Estado |
|---|---|
| Onboarding multi-tenant / white-label | ✓ Producción |
| RBAC: administrador / jefe / comisionado | ✓ Producción |
| Sociedades (entidades empleadoras) | ✓ Producción |
| Comisionados (vendedores/agentes) | ✓ Producción |
| Planes de comisiones con componentes y overrides | ✓ Producción |
| Metas por comisionado y equipo | ✓ Producción |
| Campañas (aceleradores temporales) | ✓ Producción |
| Fuentes de datos / transacciones | ✓ Producción |
| Períodos de liquidación | ✓ Producción |
| Cálculo base (resultados_calculo, movimientos_devengo) | ✓ Schema, motor pendiente |
| Disputas | ✓ Producción |
| Carga masiva CSV (transacciones y comisionados) | ✓ Producción |
| Reportes básicos | ✓ Producción |
| Normativa laboral multi-país (CL/PE/CO/MX/AR) | ✓ Producción |
| Nodos de jerarquía para jefe comercial | ✓ Schema, UI pendiente |
| Portal del comisionado | ✗ Pendiente |
| Equipo / gestión de usuarios | ✓ Producción (básico) |

---

## Brechas por prioridad

### Prioridad ALTA — Bloqueantes de venta en demos

#### B-01 Portal del comisionado con trazabilidad de cálculo

**Qué tiene SAP:** Los vendedores tienen un portal propio donde ven exactamente cuánto ganaron, el detalle de cada transacción que contribuyó, la fórmula aplicada, y el estado de pago. Es el módulo más valorado por los usuarios finales.

**Qué tiene Devenga:** Las tablas `resultados_calculo` y `movimientos_devengo` existen, pero no hay UI para el comisionado. Solo el administrador ve los datos.

**Impacto de no tenerlo:** El comisionado no confía en el sistema. Las disputas aumentan. En demos, es el primer módulo que pide ver el cliente.

**Especificación:**
- Ruta: `/portal` (dominio separado del dashboard de admin)
- El comisionado se loguea con su cuenta y ve solo sus datos
- Vista: mis comisiones por período, desglose por transacción, estado (calculado / aprobado / pagado)
- Detalle de transacción: qué regla del plan se aplicó, tasa o monto, aceleradores activos
- Historial de períodos cerrados (últimos 12)
- Acceso a sus disputas activas y resueltas
- Notificación cuando se cierra un período (email o en-app)

**Dependencias de schema:** `resultados_calculo`, `movimientos_devengo`, `transacciones`, `disputas`, `acuses_nomina`

---

#### B-02 Flujo de aprobación de liquidaciones (workflow de cierre)

**Qué tiene SAP:** Flujo multi-nivel configurable: calculado → revisión manager → aprobación gerencia → envío a nómina. Con comentarios, rechazos y auditoría completa.

**Qué tiene Devenga:** La tabla `puertas_aprobacion` existe en el schema (5 puertas configuradas en seed), pero no hay workflow implementado. El período se cierra sin aprobaciones.

**Impacto de no tenerlo:** Las empresas con más de 30 vendedores requieren este proceso obligatoriamente. Sin workflow, el producto no aplica a ese segmento.

**Especificación:**
- Configuración de puertas por tenant: quién aprueba cada puerta (rol o usuario específico)
- Estado del período: `borrador → en_calculo → revisión_jefe → aprobación_gerencia → aprobado → enviado_nomina`
- El jefe puede ver los resultados de su equipo y aprobar o rechazar con comentario
- El admin ve el estado consolidado de todas las puertas
- Al alcanzar la puerta final, el período queda `congelado` y los movimientos se marcan `aprobados`
- Auditoría: registro de quién aprobó qué y cuándo

**Dependencias de schema:** `puertas_aprobacion`, `periodos`, `resultados_calculo`; nueva tabla `aprobaciones_periodo`

---

#### B-03 Plan Communicator — Aceptación digital del plan

**Qué tiene SAP:** El comisionado recibe su plan de comisiones, lo revisa en el portal y lo acepta digitalmente. Queda un registro firmado (timestamp + IP). Es evidencia legal de que conoció y aceptó las condiciones.

**Qué tiene Devenga:** La tabla `asignaciones_plan` existe pero no tiene flujo de aceptación ni registro de consentimiento.

**Impacto de no tenerlo:** En disputas laborales en Chile y Colombia, la empresa necesita probar que el trabajador conocía su esquema. Sin este registro, el riesgo legal recae completamente en el empleador.

**Especificación:**
- Al asignar un plan a un comisionado, el sistema genera una notificación
- En el portal del comisionado, aparece un banner "Tienes un plan pendiente de aceptar"
- El comisionado puede descargar el PDF del plan antes de aceptar
- Al aceptar: se registra `aceptado_en` (timestamp), `aceptado_ip`, `version_plan`
- Si rechaza: puede escribir un motivo; el admin recibe notificación
- Alerta automática si el comisionado no acepta en X días (configurable)
- El acuse queda en `acuses_nomina` o nueva tabla `acuses_plan`

**Dependencias de schema:** `asignaciones_plan`, `plantillas_plan`; nueva tabla `acuses_plan` o campo en `asignaciones_plan`

---

### Prioridad ALTA — Completan el ciclo funcional

#### B-04 Quota Management formal

**Qué tiene SAP:** Módulo completo de gestión de cuotas: definición por territorio/producto/período, distribución automática (uniforme, histórica, ponderada), aprobación de cuotas por el manager, ajustes mid-ciclo con auditoría, y comparativo cuota vs. logro en tiempo real.

**Qué tiene Devenga:** Tabla `metas` existe, pero es solo un registro de valor objetivo. Falta el proceso alrededor.

**Especificación:**
- Flujo de asignación de cuota: admin propone → jefe ajusta → comisionado ve → cierre de período la congela
- Distribución automática: distribuir una cuota de equipo entre comisionados (uniforme o por peso configurable)
- Comparativo cuota vs. logro en tiempo real durante el período activo
- Ajuste de cuota mid-ciclo: requiere aprobación y deja registro de la razón
- Historial de cuotas por comisionado (últimos 4 períodos)

---

#### B-05 Proyección de comisiones (Pipeline View / Simulator)

**Qué tiene SAP:** El vendedor puede ingresar sus oportunidades esperadas y ver cuánto ganaría si las cierra. También puede simular el efecto de distintos montos de venta sobre su comisión.

**Qué tiene Devenga:** No existe.

**Impacto de no tenerlo:** Es una herramienta de motivación. Los planes de comisiones son más efectivos cuando el vendedor puede ver en tiempo real el impacto de cada venta adicional.

**Especificación:**
- En el portal del comisionado: sección "¿Cuánto ganaría si..."
- Input: monto de venta hipotético (o lista de oportunidades)
- Output: comisión proyectada según el plan activo, incluyendo aceleradores que se activarían
- Cálculo en el cliente (no requiere guardar datos) usando la misma lógica del motor
- Opcional: integración con pipeline del CRM (fase posterior)

---

#### B-06 Modelado what-if de planes (Plan Modeling)

**Qué tiene SAP:** El equipo de compensaciones puede crear versiones "sandbox" de un plan, simular el costo histórico con datos reales, comparar variantes y aprobar la que mejor equilibre costo y motivación, antes de publicarla.

**Qué tiene Devenga:** Los planes tienen versiones, pero no hay simulación de costo con datos históricos.

**Especificación:**
- Modo "borrador" para planes: puede editarse sin afectar el cálculo activo
- Simulación: ejecutar el motor sobre un período cerrado con un plan alternativo
- Comparativo: costo total del plan actual vs. plan alternativo para ese período
- Vista: por comisionado (cuánto hubiera ganado) y total (cuánto hubiera costado)
- El resultado es solo lectura; no genera movimientos reales

---

### Prioridad MEDIA — Necesarios para enterprise

#### B-07 Conector Salesforce (y CRM genérico)

**Qué tiene SAP:** Integración nativa bidireccional con Salesforce (y otros CRM). Las oportunidades cerradas en SF alimentan automáticamente el motor de comisiones. El vendedor ve en SF cuánto ganó por cada deal.

**Qué tiene Devenga:** Las fuentes de datos son configurables y hay carga masiva CSV, pero no hay conector automático a ningún CRM.

**Especificación:**
- Conector Salesforce: autenticación OAuth, pull de `Opportunity` (cerradas ganadas) vía REST API
- Mapeo configurable: campo SF → campo `transacciones` de Devenga
- Frecuencia de sincronización: manual o programada (cada hora / día)
- Conector genérico via webhook: cualquier CRM puede hacer POST a un endpoint de Devenga
- Conector HubSpot (segunda prioridad en LATAM)
- Registro de errores de sincronización con reintentos

---

#### B-08 Notificaciones y alertas

**Qué tiene SAP:** Sistema completo de notificaciones: email y en-app. Alertas configurables por evento (período abierto, resultado disponible, meta alcanzada, disputa respondida, plan por vencer).

**Qué tiene Devenga:** No hay sistema de notificaciones.

**Especificación:**
- Canales: email (via Resend/SendGrid) y notificación en-app (badge en nav)
- Eventos notificables: período calculado, plan asignado, meta actualizada, disputa respondida, acercamiento a meta (75% / 90%), aprobación pendiente
- El comisionado puede configurar qué notificaciones recibe
- El admin puede enviar comunicados masivos al equipo

---

#### B-09 Auditoría y trazabilidad completa

**Qué tiene SAP:** Registro inmutable de todos los cambios: quién cambió qué plan, cuándo, qué valores tenía antes. Los movimientos de devengo son inmutables y referenciables por período.

**Qué tiene Devenga:** Los movimientos son inmutables por diseño. Falta el log de cambios en planes, metas y configuración.

**Especificación:**
- Tabla `audit_log`: `tabla`, `registro_id`, `campo`, `valor_anterior`, `valor_nuevo`, `usuario_id`, `created_at`
- Triggers en: `plantillas_plan`, `componentes_plan`, `metas`, `asignaciones_plan`, `overrides_plan`
- UI de auditoría en el admin: historial de cambios por plan o por comisionado
- Los períodos cerrados son inmutables; cualquier corrección genera un período nuevo (comportamiento actual correcto)

---

#### B-10 Integración con sistemas de nómina (outbound estructurado)

**Qué tiene SAP:** Conectores certificados con SAP HCM, SuccessFactors, ADP, Workday. Genera archivos en el formato exacto de cada nómina.

**Qué tiene Devenga:** Genera movimientos de devengo en la DB. El export es CSV genérico.

**Especificación:**
- Export Suel2: archivo .txt con estructura de interfaz de variables
- Export SAP HCM: IDoc o archivo delimitado en formato LSMW
- Export Excel estándar: plantilla por país con conceptos ya clasificados
- Webhook saliente: POST a endpoint de nómina cuando se aprueba un período
- Cada template de export es configurable por tenant/sociedad

---

### Prioridad BAJA — Diferenciadores para enterprise grande

#### B-11 Gamificación y leaderboards

**Qué tiene SAP:** Rankings de vendedores, badges por metas alcanzadas, notificaciones de "superaste a X", visualizaciones de progreso estilo velocímetro.

**Especificación:**
- Leaderboard por período: ranking del equipo visible para todos los comisionados
- Barra de progreso hacia la meta en el portal del comisionado
- Badges: primera venta del mes, meta superada, top 3 del equipo
- Configurable por tenant (puede desactivarse)

---

#### B-12 Territorio y gestión geográfica

**Qué tiene SAP:** Módulo de Territory Management: asignación de cuentas/regiones a vendedores, evitar conflictos de atribución, reglas de split de comisión entre territorios.

**Especificación:**
- Campo `territorio` en comisionados y transacciones
- Reglas de atribución: si una transacción pertenece a más de un territorio, cómo se divide la comisión
- Vista de jefe por territorio (extiende el nodo de jerarquía actual)

---

#### B-13 Análisis avanzado y BI

**Qué tiene SAP:** Dashboards con SAP Analytics Cloud. Tendencias de costo de comisiones, correlación plan-performance, ROI del incentivo.

**Especificación:**
- Dashboard de analytics para el admin: costo total de comisiones por período, costo por vendedor, evolución histórica
- Métricas clave: ratio comisión/venta, efectividad de aceleradores, distribución de payout (% que supera meta)
- Export a Power BI / Google Looker via conector o CSV programado
- Gráficos nativos básicos en el dashboard (sin dependencia de SAP AC)

---

## Ventajas de Devenga que deben reforzarse

Estas son las razones por las que un cliente elige Devenga sobre SAP. Deben mencionarse explícitamente en demos y materiales de venta.

| Ventaja | Argumento concreto |
|---|---|
| **Normativa laboral LATAM nativa** | SAP no calcula devengo diario para semana corrida (Chile), gratificación proporcional, SBC variable (México), CTS (Perú). Un cliente en CL o CO ahorra 3-6 meses de consultoría solo en este punto. |
| **Precio** | TCO 4-10x menor. SAP: USD 150-400/usuario/mes + implementación USD 80K-400K. Devenga: fracción del precio, sin consultor. |
| **Time-to-value** | SAP requiere 6-18 meses de implementación. Devenga opera en semanas desde el onboarding. |
| **Multi-país en un solo tenant** | Para grupos regionales (ej: empresa con operaciones en CL + CO + MX), Devenga es el único SaaS que maneja las tres normativas en un solo workspace. |
| **Sin dependencia de consultores** | El administrador del cliente gestiona los planes directamente. SAP requiere un consultor certificado para casi cualquier cambio. |
| **Soporte en español, horario LATAM** | SAP opera desde centros de soporte en Europa o India. Devenga puede ofrecer soporte directo en zona horaria Chile/Colombia/México. |

---

## Orden de implementación recomendado

| Fase | Brechas | Justificación |
|---|---|---|
| **v2 Fase B** (próxima) | B-01 Portal comisionado, B-02 Workflow aprobaciones, B-03 Aceptación digital | Completan el ciclo mínimo para vender a empresas medianas |
| **v2 Fase C** | B-04 Quota Management, B-05 Simulador, B-08 Notificaciones | Profundizan retención y uso diario |
| **v3** | B-07 Conector Salesforce, B-09 Auditoría, B-10 Export nómina estructurado | Habilitadores de deals enterprise |
| **v3+** | B-06 Modelado what-if, B-11 Gamificación, B-12 Territorio, B-13 BI | Diferenciadores para segmento grande |

---

*Documento vivo — actualizar cuando se complete cada brecha o cuando cambie la oferta de SAP Commissions.*
