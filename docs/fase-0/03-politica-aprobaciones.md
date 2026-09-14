# Política de aprobaciones

Fuente: §4 de la especificación funcional v1.

Contraparte ejecutable: [`src/lib/dominio/aprobaciones.ts`](../../src/lib/dominio/aprobaciones.ts)
(`PUERTAS_APROBACION`, `CONTROLES_BLOQUEANTES`, `SEGREGACION_DE_FUNCIONES`) y
`supabase/puertas_aprobacion`, `controles_bloqueantes`, `segregacion_funciones`
(sembradas en [`supabase/seed_fase0.sql`](../../supabase/seed_fase0.sql) vía `schema.sql`).

## Las seis puertas (§4.1)

| # | Puerta | Qué se confirma | Quién | Qué queda |
|---|---|---|---|---|
| 1 | Aprobación de plantilla | Estructura y costo proyectado | Dueño comercial + control de gestión | Versión firmada, simulación adjunta |
| 2 | Aprobación de meta | Magnitud y destino | Jefatura según workflow de la sociedad | Versión de meta con motivo |
| 3 | Autorización de campaña | Multiplicador, alcance retroactivo, presupuesto | Nivel según monto proyectado | Autorización previa a publicación |
| 4 | Congelamiento de cálculo | Nada cambia desde aquí | Automático al corte | Snapshot + hash |
| 5 | Aprobación de liquidación | Importes a enviar a nómina | Jefatura comercial + control | Acta con totales y excepciones |
| 6 | Acuse de pago | Lo enviado fue pagado | Nómina | Conciliación cerrada |

El documento del comisionado es **definitivo solo tras la puerta 6**. Antes, es provisional y
se muestra como tal (ver estados del portal, §5).

## Controles bloqueantes de cierre (§4.2)

No es posible cerrar un período si existe alguno de:

1. Transacción en cuarentena sin resolver
2. Split que no suma 100%
3. Comisionado sin vínculo laboral vigente a la `fecha_devengo`
4. Concepto sin `devengo_diario` resuelto o sin `incide_en[]` para el país
5. Campaña publicada sin autorización registrada
6. Override sin motivo o sin aprobador
7. Meta en estado borrador con resultados calculados contra ella
8. Tipo de cambio faltante para alguna moneda del período
9. Diferencia entre el total calculado y el total de movimientos generados
10. Monto que excede `presupuesto_tope` de campaña sin autorización superior

## Segregación de funciones (§4.4)

Quien carga metas no aprueba metas. Quien diseña planes no aprueba liquidaciones. Quien
resuelve disputas no aprueba ajustes propios. En banca y seguros esto es condición de
auditoría, no preferencia.

## Expediente probatorio (§4.3)

Por comisionado y período: documento congelado + snapshot de reglas + lista de créditos con su
hash de origen + versiones de meta, jerarquía, plan y campaña + cadena de aprobaciones + acuse
de nómina. Reconstruible sin acceso al sistema de origen.

Retención: **7 años** como política única propuesta — **[Suposición]**, revisar contra el
plazo más largo de los cinco países antes de fijarlo en contrato (riesgo relacionado en
[`05-riesgos.md`](./05-riesgos.md)).
