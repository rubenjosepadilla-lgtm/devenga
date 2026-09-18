# Primera prueba end-to-end contra Supabase real (2026-09-18)

Cada resumen de fase (Fase 1, 2 y 3) advertía lo mismo: nada se había
ejercitado contra una base de datos Postgres real, solo compilación, lint y
el motor de cálculo en memoria (`npm run demo`). Esta fue la primera vez que
se probó el flujo completo — registro, sociedad, comisionado, plan,
transacción, período, cálculo, cierre, documento y acuse — contra un
proyecto Supabase real (`qopktjqprkmavmnsmdjt`, región `sa-east-1`).

Encontramos y corregimos **nueve bugs reales**, todos invisibles en revisión
de código porque dependían de comportamiento concreto de Postgres/PostgREST
que no se podía verificar sin una base de datos real.

## Bugs encontrados y corregidos

1. **RLS bloqueaba crear un comisionado.** `crearComisionadoConVinculo`
   encadenaba `.insert().select().single()` para leer el id recién creado,
   pero justo después del insert el comisionado todavía no tiene vínculo a
   ninguna sociedad — ninguna política de `SELECT` matchea esa fila todavía,
   y Postgres reporta ese fallo del `RETURNING` implícito como si fuera el
   propio insert. Fix: generar el `id_comisionado` en el servidor
   (`randomUUID()`) y no depender de leerlo de vuelta.
   (`src/app/dashboard/comisionados/actions.ts`)

2. **Faltaba UI para aprobar una plantilla y para asignarla a un
   comisionado.** El orquestador de cálculo (§3.3) solo considera plantillas
   `aprobado`/`vigente` con al menos una asignación — sin esas dos acciones,
   ningún cálculo podía producir nunca un resultado, para nadie. Se agregaron
   `aprobarPlantilla` y `crearAsignacion` con su UI en `/dashboard/planes`.

3. **Tres tablas quedaron sin política de escritura, solo de lectura.**
   `periodos` (sin `INSERT`), `creditos` y `resultados_calculo` (sin
   `INSERT`/`UPDATE`/`DELETE` en ninguna de las dos). El motor de cálculo
   escribe en estas tablas actuando con la sesión del usuario, no con una
   service role — sin estas políticas, calcular o cerrar un período fallaba
   de inmediato. (`supabase/schema_fixes_2026_09.sql`)

4. **`${periodo}-31` no es una fecha válida en septiembre (ni en ningún mes
   de 30 días).** El límite superior del rango de fechas al calcular y al
   revisar controles usaba un `-31` fijo. Postgres rechaza esa fecha
   ("date/time field value out of range"), y como el código no revisaba el
   `error` de esa consulta específica, el resultado era simplemente "0
   transacciones encontradas" — no un error visible. Fix:
   `finDeMes(periodo)` calcula el último día real del mes (bisiestos
   incluidos) en `src/lib/dominio/fase1/periodo.ts`, usado en los tres
   lugares que tenían el `-31` fijo. De paso se agregó revisión de `error`
   donde faltaba.

5. **`creditos.snapshot_jerarquia` era `NOT NULL`,** pero un comisionado sin
   nodo de jerarquía asignado (el caso normal en una organización chica, como
   la de esta misma prueba) genera créditos con `snapshot_jerarquia = null`
   legítimamente. El insert fallaba en silencio por el mismo problema de
   errores no revisados. Fix: la columna ahora acepta `null`.

6. **`null` no es `undefined` — tres lugares comparaban mal.**
   `aplicarTope`, `aplicarCampana` y `simularCampana` usaban
   `valor !== undefined` para decidir si un campo opcional (`tope_componente`,
   `multiplicador`, `monto`) estaba seteado. Una columna nullable sin valor
   llega desde Postgres como `null`, no `undefined` — `null !== undefined` es
   `true` en JS, así que el código entraba igual a la rama "sí está seteado"
   y luego `Math.min(importe, null)` (que JS coacciona a
   `Math.min(importe, 0)`) devolvía **0** en vez de dejar el importe intacto.
   Este bug es el que hizo que la primera comisión calculada diera $0 en vez
   de $30.000. Fix: las tres comparaciones ahora usan `== null` / `!= null`,
   que cubren ambos casos. (`src/lib/motor/calculo.ts`, `campana.ts`,
   `simulacion.ts`)

7. **`caracter` es un objeto anidado en TypeScript, pero la tabla lo guarda
   como dos columnas planas.** `Concepto.caracter` y `MovimientoDevengo.caracter`
   son `{ principalidad, ordinariedad }` en el modelo de dominio, pero ni
   `conceptos` ni `movimientos_devengo` tienen una columna `caracter` — son
   dos columnas de texto separadas. Al insertar un movimiento, supabase-js
   arma la lista de columnas de un insert masivo con `Object.keys()` del
   objeto — que sí incluye `caracter` aunque su valor sea `undefined` (a
   diferencia de `JSON.stringify`, que la habría descartado) — y Postgres
   respondía "no existe la columna caracter". Fix: adaptadores
   `filaAConcepto` / `movimientoParaFila` en el nuevo
   `src/lib/datos/mapeo.ts`, que traducen entre la forma anidada de dominio y
   la forma plana de fila en los dos bordes (lectura de conceptos, escritura
   de movimientos).

8. **El cierre de período no era seguro ante fallos parciales.** La ruta
   marcaba los resultados como `congelado` **antes** de construir e insertar
   los movimientos. Cuando el paso de insertar movimientos fallaba (como pasó
   con el bug #7), los resultados quedaban `congelado` sin movimiento — y
   como el cierre solo busca resultados `preliminar`, un reintento ya no los
   encontraba. El período incluso se llegó a marcar `cerrado` con
   `movimientos_generados: 0`. Fix: se reordenó la ruta para construir y
   validar los movimientos primero, y solo marcar `congelado` (con su
   `id_movimiento`) después de insertarlos exitosamente — un fallo a mitad de
   camino ya no deja nada a medio mutar. (`src/app/api/periodos/[id]/cerrar/route.ts`)

9. **Manejo de errores demasiado optimista en varias consultas.** Varias
   llamadas a Supabase no revisaban el campo `error` de la respuesta,
   tratando cualquier fallo como "0 filas" en vez de como un error real — el
   síntoma común detrás de los bugs #3, #4 y #5. Se agregó revisión explícita
   de `error` en los puntos que este ejercicio tocó
   (`calcular/route.ts`); es razonable asumir que existen más casos sin
   revisar en rutas que esta prueba no llegó a ejercitar.

## Qué se verificó funcionando de punta a punta

Con los nueve fixes aplicados, este flujo completo corrió sin errores contra
el proyecto Supabase real:

registro (con confirmación de email real) → login → crear sociedad → el
trigger de alta automática como admin funcionó → crear comisionado → crear
plantilla → agregar componente (tasa lineal 3%) → aprobar plantilla (puerta
1) → asignar a un comisionado → registrar una fuente → ingestar una
transacción ($1.000.000) → abrir un período → calcular (**$30.000**,
exactamente 3% — verificado a mano) → revisar controles bloqueantes (sin
violaciones) → cerrar el período → movimiento de devengo generado con
clasificación legal completa (`incide_en`, `devengo_diario`,
`principalidad`/`ordinariedad`) → documento del comisionado (`/documentos/[id]`)
mostrando el detalle completo → registrar acuse de nómina → estado final
"Pagado".

## Datos de prueba que quedaron en el proyecto

El proyecto Supabase real ahora tiene datos de prueba: una sociedad
("Sapport Comercial"), un comisionado, una plantilla de plan, una
transacción, un período cerrado y su movimiento de devengo, más una cuenta
de usuario (`rpadilla+devenga-test@sapport.cl`). Es un entorno de desarrollo,
así que se dejaron tal cual en vez de borrarlos — bórralos manualmente
cuando quieras arrancar con datos limpios.
