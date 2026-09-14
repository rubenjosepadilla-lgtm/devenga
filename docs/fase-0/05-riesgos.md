# Riesgos declarados

Fuente: §9 de la especificación funcional v1. Se listan tal cual para que queden trazados
desde el inicio del proyecto — no se resuelven acá, se declaran.

| # | Riesgo | Estado |
|---|---|---|
| 1 | Sin opinión legal firmada en Perú, Colombia, México y Argentina. La matriz de [`01-matriz-legal.md`](./01-matriz-legal.md) se apoya en fuentes secundarias | Aceptado por decisión — declarar en contrato |
| 2 | Argentina es blanco móvil. Aparecen referencias a una reforma laboral 2026 que tocaría bases de cálculo **[Suposición — no verificado]** | Verificar antes de comprometer Argentina en v1 |
| 3 | Zona gris chilena: si un premio condicionado a meta mensual se entiende devengado diariamente al cumplirse la condición | Requiere opinión firmada; el motor obliga a declarar postura |
| 4 | El anexo con detalle por operación es especificidad chilena. El diferenciador más fuerte del producto no aplica igual en los otros cuatro mercados | Cambia el discurso comercial por país |
| 5 | Multi-sociedad del mismo comisionado soportado como excepción, con efectos tributarios no evaluados por el motor | Aprobación adicional obligatoria |
| 6 | Alcance v1 amplio: cinco países, portal, disputas, cinco modos de integración | Ver fases (§10) |
| 7 | Sin canal ni ICP definido para este producto. El ICP de nómina compleja y el ICP de fuerza de venta no son el mismo mercado | Abierto |

## Decisión de esta sesión

El usuario optó por construir la Fase 0 **cubriendo los cinco países desde el inicio**, en
lugar de la secuencia recomendada por la especificación (§10: Chile en Fase 1, los otros
cuatro países uno por uno en Fase 4, cada uno con su opinión legal firmada antes de entrar).

Esto **no** resuelve el riesgo #1: seguimos sin opinión legal firmada para Perú, Colombia,
México y Argentina. Construir la matriz y el catálogo para los cinco países ahora es trabajo
de modelado (estructura de datos, validaciones, esquema), no una sustitución de esa opinión
legal. Antes de calcular una sola comisión real fuera de Chile, cada fila marcada `probable` o
`suposicion` en la matriz legal debe pasar por un laboralista local y quedar re-etiquetada
`seguro` (o corregida).
