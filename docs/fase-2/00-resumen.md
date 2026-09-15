# Fase 2 — Gobierno

Cubre §10 "Fase 2 — Gobierno" de la especificación: campañas con
autorización y simulación, metas con workflow, controles bloqueantes con
vista previa, y cierre. La mayor parte del modelo de datos ya existía en
Fase 1 (§2.7 metas, §2.8 campañas); esta fase construye el **workflow real**
sobre ese modelo — antes, cualquier fila con el estado correcto pasaba, sin
que nada forzara la secuencia ni la segregación de funciones.

## Qué se construyó

- **Simulación de campaña** (§3.5 punto 2) — [`src/lib/motor/simulacion.ts`](../../src/lib/motor/simulacion.ts):
  dado el detalle diario ya calculado de un concepto, proyecta el costo
  incremental de la campaña bajo los dos valores de `alcance_retroactivo`, y
  lista los beneficios derivados del país que quedarían afectados (tomados
  de la matriz legal de Fase 0). Se corre desde `GET /api/campanas/[id]/simular`,
  antes de autorizar.
- **Presupuesto de campaña** (§2.8 regla 4) — `POST /api/campanas/[id]/publicar`
  calcula el devengo proyectado con el mismo motor de simulación y bloquea la
  publicación si excede `presupuesto_tope`, a menos que se registre una
  excepción con motivo (≥20 caracteres) y quede su propia evidencia de
  autorización (`excepcion_presupuesto_*` en `campanas`, distinta de la
  autorización de la puerta 3).
- **Workflow de metas en dos pasos** (§2.7, §4.4) — `POST /api/metas/[id]/enviar-aprobacion`
  (rol `carga_metas`, borrador→en_aprobación) y `POST /api/metas/[id]/aprobar`
  (rol `aprueba_metas`, en_aprobación→vigente) son ahora políticas RLS
  **distintas**, cada una con su propia transición de estado permitida — no
  solo una convención de la UI, sino una regla que Postgres hace cumplir.
  `POST /api/metas/[id]/corregir` crea una nueva versión (nunca edita) con
  `motivo_version` obligatorio; un trigger marca automáticamente la versión
  anterior como `superada` cuando la nueva queda `vigente`.
- **Vista previa de controles bloqueantes** (§4.2) — `GET /api/periodos/[id]/controles`
  corre los mismos diez controles que el cierre real, sin cerrar nada. La
  lógica de agregación (antes duplicada) se compartió en
  [`src/lib/datos/insumos-cierre.ts`](../../src/lib/datos/insumos-cierre.ts)
  para que la vista previa y el cierre real vean exactamente los mismos datos.

## Simplificaciones declaradas

1. **Simulación de campaña asume un solo mes.** `obtenerBaseDiariaCampana`
   busca el período cuyo `periodo` coincide con el mes de
   `vigencia_hecho_desde`; una campaña que cruza dos meses calendario no está
   cubierta.
2. **Simulación sin base calculada devuelve un error, no un costo de $0.**
   Si nadie ha ejecutado el cálculo del período para ese concepto todavía,
   `/simular` responde 409 explicando que hay que calcular primero, en vez de
   mostrar un proyectado engañoso.
3. **La excepción de presupuesto al publicar sí permite $0 de base.** A
   diferencia del punto anterior, `publicar` trata la ausencia de base como
   "proyectado = 0" en vez de bloquear — publicar una campaña antes de que
   existan ventas del mes es el caso normal (se publica para incentivar
   ventas futuras), no una situación de error.
4. **El workflow de metas es fijo, no configurable por sociedad.** La
   especificación (§2.7) menciona "workflow configurable por sociedad"; se
   implementó un único flujo de dos pasos (carga → aprueba) igual para todas
   las sociedades. Configurar workflows distintos por sociedad queda pendiente.
5. **La segregación "quien carga metas no aprueba metas" (§4.4) se hace por
   rol, no por persona.** Si el mismo usuario tiene ambos roles asignados en
   `usuario_rol_sociedad`, puede cargar y aprobar la misma meta. Impedir que
   la *misma persona* haga ambas cosas (comparando `cargada_por` contra el
   usuario que aprueba) es un refuerzo pendiente.

## Qué no se pudo verificar

Igual que en Fase 1: sin un proyecto Supabase real conectado a esta sesión,
no se pudo ejercitar ninguna ruta nueva contra Postgres — ni la simulación,
ni el workflow de metas, ni la vista previa de controles. Se verificó
compilación (`tsc --noEmit`), build de producción y lint, todos limpios.
Antes de confiar en esto con datos reales, aplica
`supabase/schema_fase2.sql` sobre un proyecto con Fase 0 y Fase 1 ya
aplicadas, y prueba el flujo manualmente: cargar una meta → enviarla a
aprobación → aprobarla con un usuario distinto; crear una campaña → simular
→ autorizar → publicar (con y sin exceder presupuesto).
