-- =============================================================================
-- Semilla Fase 0 — matriz legal (§7) y catálogo de conceptos (§2.5).
--
-- Espejo de src/lib/dominio/matriz-legal.ts y conceptos.ts. Mientras no exista
-- un generador único, mantener ambos en sincronía manualmente al editar cualquiera.
-- =============================================================================

-- ---- Matriz legal por país -------------------------------------------------

insert into public.matriz_legal_pais (pais, regla_comision, confianza_calificacion, riesgo_declarado) values
('CL',
 'Se devenga en el período de la operación y se liquida con las remuneraciones de ese período, ' ||
 'con independencia de la condición de pago pactada con el cliente. La Dirección del Trabajo exige ' ||
 'que la remuneración variable sea devengada diariamente, principal y ordinaria para integrar la base ' ||
 'de semana corrida; niega el beneficio a comisiones mensuales sobre venta neta del establecimiento ' ||
 'repartidas entre vendedores. Anexo obligatorio con detalle por operación y método de cálculo.',
 'seguro',
 'Zona gris: si un premio condicionado a meta mensual se entiende devengado diariamente al cumplirse ' ||
 'la condición. Requiere opinión firmada; el motor obliga a declarar postura (§9.3).'),

('PE',
 'Doble régimen. Comisión complementaria: entra a CTS y gratificaciones solo si se percibió al menos ' ||
 '3 meses en el semestre, sumando y dividiendo entre 6. Comisión como remuneración principal ' ||
 '(comisionista puro): promedio del semestre sin requisito de regularidad.',
 'seguro',
 'Sin opinión legal firmada en el foro local (§9.1) — matriz apoyada en fuentes secundarias.'),

('CO',
 'Los porcentajes sobre ventas y comisiones son salario por texto expreso del art. 127 CST. ' ||
 'Base de prestaciones sociales, cesantías, prima e IBC. Con salario variable se liquida sobre promedio.',
 'seguro',
 'Sin opinión legal firmada en el foro local (§9.1) — ventanas de promedio en [Probable].'),

('MX',
 'El componente variable se integra al SBC promediando los ingresos de los dos meses inmediatos ' ||
 'anteriores divididos por los días de salario devengado, con aviso bimestral al IMSS. Para salario ' ||
 'variable, base de cálculo = promedio de los 30 días anteriores al nacimiento del derecho.',
 'seguro',
 'Sin opinión legal firmada en el foro local (§9.1) — matriz apoyada en fuentes secundarias.'),

('AR',
 'SAC = 50% de la mayor remuneración mensual devengada del semestre. Las comisiones no se promedian: ' ||
 'se suman al mes en que se devengaron. Un mes con un multiplicador alto redefine el aguinaldo del ' ||
 'semestre completo.',
 'seguro',
 'Blanco móvil: referencias no verificadas a una reforma laboral 2026 que tocaría bases de cálculo ' ||
 '(§9.2) — verificar antes de comprometer Argentina en v1.');

-- ---- Incidencias por país ---------------------------------------------------

insert into public.matriz_legal_incidencia (pais, beneficio, ventana_calculo, confianza) values
('CL', 'semana_corrida', 'diaria — solo si devengo_diario = true, principal y ordinaria', 'seguro'),
('CL', 'gratificacion', 'anual sobre remuneración devengada', 'probable'),
('CL', 'feriado', 'promedio últimos 3 meses de variable', 'probable'),
('CL', 'indemnizaciones', 'promedio últimos 3 meses o últimos 12 según concepto', 'probable'),
('CL', 'base_imponible', 'mensual, tope imponible vigente', 'seguro'),

('PE', 'cts', 'complementaria: suma semestre / 6 si ≥3 meses percibidos; principal: promedio semestral sin requisito', 'seguro'),
('PE', 'gratificaciones', 'igual regla que CTS según tipo de comisión', 'seguro'),
('PE', 'vacaciones', 'promedio semestral', 'seguro'),
('PE', 'cts_al_cese', 'proporcional al semestre en curso', 'seguro'),

('CO', 'prima', 'promedio del semestre (ventana exacta pendiente de opinión local)', 'probable'),
('CO', 'cesantias', 'promedio anual devengado', 'probable'),
('CO', 'intereses_cesantias', 'sobre saldo de cesantías del año', 'probable'),
('CO', 'vacaciones', 'promedio del año o de los últimos 3 meses si es más favorable', 'probable'),
('CO', 'ibc', 'mensual, según ingreso variable devengado', 'seguro'),
('CO', 'indemnizacion', 'promedio último año', 'probable'),

('MX', 'sbc_imss', 'bimestral — promedio 2 meses anteriores / días de salario devengado, con aviso IMSS', 'seguro'),
('MX', 'aguinaldo', 'promedio de los 30 días anteriores al nacimiento del derecho', 'seguro'),
('MX', 'prima_vacacional', 'misma base que aguinaldo', 'seguro'),
('MX', 'indemnizacion', 'promedio de los 30 días anteriores', 'seguro'),

('AR', 'sac', 'no promedia — 50% de la mayor remuneración mensual devengada del semestre', 'seguro'),
('AR', 'vacaciones', 'sobre la mejor remuneración del semestre', 'seguro'),
('AR', 'indemnizacion', 'mejor remuneración mensual, normal y habitual, del último año', 'seguro');

-- ---- Catálogo de conceptos (semilla representativa, no exhaustiva) ---------

insert into public.conceptos
  (codigo, nombre, pais, naturaleza, base_devengo, evento_devengo, devengo_diario,
   fundamento_devengo_diario, principalidad, ordinariedad, remunerativo, incide_en,
   granularidad_entrega, reversible, causales_reversion, mapeo_nomina, vigencia_desde)
values
('CL-COM-VENTA', 'Comisión por venta individual facturada', 'CL', 'comision', 'unidad_vendida', 'facturacion', true,
 'Comisión individual sobre unidades facturadas, principal y ordinaria: cumple el criterio de la ' ||
 'Dirección del Trabajo para integrar la base de semana corrida (§2.5, zona gris en §9.3 si se condiciona a meta).',
 'principal', 'ordinario', true, array['semana_corrida','gratificacion','feriado','indemnizaciones','base_imponible'],
 'diaria', true, array['anulacion_por_incumplimiento_del_trabajador'], 'HABER_COMISION_CL', '2026-01-01'),

('CL-PREMIO-META-MENSUAL', 'Premio mensual por meta grupal de establecimiento', 'CL', 'bono_meta', 'meta_grupal', 'otro', false,
 'Premio mensual repartido entre vendedores sobre venta neta del establecimiento: la DT niega ' ||
 'expresamente semana corrida a este caso (§2.5); se devenga al cierre del mes, no día a día.',
 'accesorio', 'extraordinario', true, array['gratificacion','base_imponible'],
 'mensual', true, array['meta_no_cumplida_tras_ajuste'], 'HABER_PREMIO_META_CL', '2026-01-01'),

('PE-COM-PRINCIPAL', 'Comisión como remuneración principal (comisionista puro)', 'PE', 'comision', 'unidad_vendida', 'facturacion', true,
 'Remuneración principal del comisionista puro: promedia sobre el semestre sin requisito de ' ||
 'regularidad, por lo que se registra devengo diario para permitir ese promedio exacto (§7 Perú).',
 'principal', 'ordinario', true, array['cts','gratificaciones','vacaciones','cts_al_cese'],
 'diaria', true, array['nota_de_credito_del_origen'], 'HABER_COMISION_PE', '2026-01-01'),

('CO-COM-VENTA', 'Comisión sobre ventas (art. 127 CST)', 'CO', 'comision', 'unidad_vendida', 'facturacion', true,
 'Calificada como salario por texto expreso del art. 127 CST; se liquida sobre promedio con salario ' ||
 'variable, lo que exige desagregación diaria para calcular ese promedio (§7 Colombia).',
 'principal', 'ordinario', true, array['prima','cesantias','intereses_cesantias','vacaciones','ibc','indemnizacion'],
 'diaria', true, array['nota_de_credito_del_origen'], 'HABER_COMISION_CO', '2026-01-01'),

('MX-COM-VENTA', 'Comisión sobre ventas (SBC variable)', 'MX', 'comision', 'unidad_vendida', 'facturacion', true,
 'Integra el SBC promediando los ingresos de los dos meses inmediatos anteriores entre los días de ' ||
 'salario devengado, con aviso bimestral al IMSS; requiere desagregación diaria (§7 México).',
 'principal', 'ordinario', true, array['sbc_imss','aguinaldo','prima_vacacional','indemnizacion'],
 'diaria', true, array['nota_de_credito_del_origen'], 'HABER_COMISION_MX', '2026-01-01'),

('AR-COM-VENTA', 'Comisión sobre ventas', 'AR', 'comision', 'unidad_vendida', 'facturacion', true,
 'Las comisiones no se promedian en Argentina: se suman al mes en que se devengaron y ese mes puede ' ||
 'redefinir el SAC del semestre; se registra devengo diario para identificar el mes exacto (§7 Argentina).',
 'principal', 'ordinario', true, array['sac','vacaciones','indemnizacion'],
 'diaria', true, array['nota_de_credito_del_origen'], 'HABER_COMISION_AR', '2026-01-01');
