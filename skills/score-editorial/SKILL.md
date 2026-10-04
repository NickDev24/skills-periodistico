---
name: score-editorial
description: Sistema de puntuación editorial para ordenar noticias por interés, relevancia local, novedad, utilidad, evidencia, riesgo y saturación antes de decidir formato y publicación.
---

# Score editorial

El score ordena candidatas. No reemplaza la verificación ni permite publicar una noticia falsa o dañina.

## Variables

Puntuar de 0 a 100:
- proximidad_local
- actualidad
- novedad
- consecuencias
- utilidad
- interés_humano
- interés_publico
- calidad_fuente
- verificabilidad
- exclusividad
- saturacion
- riesgo

## Principio

Primero aplicar filtros duros:
1. ¿Hay un hecho identificable?
2. ¿Hay evidencia suficiente?
3. ¿Se puede atribuir correctamente?
4. ¿Existe riesgo que exija abstención o tratamiento especial?

Después ordenar por interés editorial.

## Fórmula inicial recomendada

interes =
0.15 * proximidad_local +
0.12 * actualidad +
0.12 * novedad +
0.14 * consecuencias +
0.10 * utilidad +
0.08 * interes_humano +
0.08 * interes_publico +
0.08 * calidad_fuente +
0.08 * verificabilidad +
0.05 * exclusividad

score_final = interes - 0.05 * saturacion - 0.05 * riesgo

Mantener el resultado entre 0 y 100.

## Reglas

- Una noticia con score alto y evidencia insuficiente no se publica.
- Una noticia con score medio y gran utilidad local puede ser prioritaria.
- Una noticia exclusiva no recibe permiso para exagerar.
- El score es un ranking inicial. Las métricas reales del medio deben recalibrar los pesos.

## Salida sugerida

{
  "score": 0,
  "prioridad": "alta|media|baja",
  "factores": {},
  "angulo_recomendado": "",
  "formato_recomendado": "",
  "publicable": true,
  "alertas": []
}
