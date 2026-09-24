# Matriz legal por país

Fuente: §7 de la especificación funcional v1. **Esta tabla es el producto.** Cada fila
determina si un concepto entra a una base derivada y con qué ventana.

Contraparte ejecutable: [`src/lib/dominio/matriz-legal.ts`](../../src/lib/dominio/matriz-legal.ts)
(`MATRIZ_LEGAL`) y `supabase/matriz_legal_pais` / `matriz_legal_incidencia`
(sembradas en [`supabase/seed_fase0.sql`](../../supabase/seed_fase0.sql)).

Etiquetas de confianza: **Seguro** prueba documental · **Probable** inferencia fuerte ·
**Suposición** información faltante.

## Chile — [Seguro]

Se devenga en el período de la operación y se liquida con las remuneraciones de ese período,
con independencia de la condición de pago pactada con el cliente. Semana corrida solo si es
devengada diariamente, principal y ordinaria. Anexo obligatorio con detalle por operación y
método de cálculo.

| Beneficio | Ventana | Confianza |
|---|---|---|
| Semana corrida | Diaria — solo si `devengo_diario = true`, principal y ordinaria | Seguro |
| Gratificación | Anual sobre remuneración devengada | Probable |
| Feriado | Promedio últimos 3 meses de variable | Probable |
| Indemnizaciones | Promedio últimos 3 o últimos 12 meses según concepto | Probable |
| Base imponible | Mensual, tope imponible vigente | Seguro |

**Riesgo declarado:** si un premio condicionado a meta mensual se entiende devengado
diariamente al cumplirse la condición es zona gris — requiere opinión firmada de laboralista.
El motor no resuelve la controversia: obliga a declarar la postura (`fundamento_devengo_diario`
en cada concepto) y la aplica de forma consistente y auditable.

## Perú — [Seguro]

Doble régimen. Comisión **complementaria**: entra a CTS y gratificaciones solo si se percibió
al menos 3 meses en el semestre, sumando y dividiendo entre 6. Comisión como **remuneración
principal** (comisionista puro): promedio del semestre sin requisito de regularidad.

| Beneficio | Ventana | Confianza |
|---|---|---|
| CTS | Complementaria: suma semestre / 6 si ≥3 meses percibidos; principal: promedio semestral sin requisito | Seguro |
| Gratificaciones | Igual regla que CTS según tipo de comisión | Seguro |
| Vacaciones | Promedio semestral | Seguro |
| CTS al cese | Proporcional al semestre en curso | Seguro |

## Colombia — [Seguro en la calificación; Probable en ventanas]

Los porcentajes sobre ventas y comisiones son salario por texto expreso del art. 127 CST.
Base de prestaciones sociales, cesantías, prima e IBC. Con salario variable se liquida sobre
promedio.

| Beneficio | Ventana | Confianza |
|---|---|---|
| Prima | Promedio del semestre (ventana exacta pendiente de opinión local) | Probable |
| Cesantías | Promedio anual devengado | Probable |
| Intereses cesantías | Sobre saldo de cesantías del año | Probable |
| Vacaciones | Promedio del año o últimos 3 meses si es más favorable | Probable |
| IBC | Mensual, según ingreso variable devengado | Seguro |
| Indemnización | Promedio último año | Probable |

## México — [Seguro]

El componente variable se integra al SBC promediando los ingresos de los dos meses inmediatos
anteriores divididos por los días de salario devengado, con aviso bimestral al IMSS. Para
salario variable, base de cálculo = promedio de los 30 días anteriores al nacimiento del
derecho.

| Beneficio | Ventana | Confianza |
|---|---|---|
| SBC / IMSS | Bimestral — promedio 2 meses anteriores / días de salario devengado, con aviso IMSS | Seguro |
| Aguinaldo | Promedio de los 30 días anteriores al nacimiento del derecho | Seguro |
| Prima vacacional | Misma base que aguinaldo | Seguro |
| Indemnización | Promedio de los 30 días anteriores | Seguro |

## Argentina — [Seguro]

SAC = 50% de la mayor remuneración mensual devengada del semestre. **Las comisiones no se
promedian**: se suman al mes en que se devengaron. Un mes con un multiplicador alto (2x, 5x)
redefine el aguinaldo del semestre completo.

| Beneficio | Ventana | Confianza |
|---|---|---|
| SAC | No promedia — 50% de la mayor remuneración mensual devengada del semestre | Seguro |
| Vacaciones | Sobre la mejor remuneración del semestre | Seguro |
| Indemnización | Mejor remuneración mensual, normal y habitual, del último año | Seguro |

## Implicancia de diseño

La ventana de promedio **no es un parámetro global**. Es `(país × concepto × beneficio)`.
Ninguna de las cinco filas coincide con otra — no generalizar entre países al implementar
Fase 1.

## Riesgos declarados sobre esta matriz (§9)

- **#1** — Sin opinión legal firmada en Perú, Colombia, México y Argentina. Aceptado por
  decisión; declarar en contrato con cada cliente.
- **#2** — Argentina es blanco móvil: referencias no verificadas a una reforma laboral 2026
  que tocaría bases de cálculo. Verificar antes de comprometer Argentina en v1.
- **#3** — Zona gris chilena sobre devengo diario de premios condicionados a meta.
