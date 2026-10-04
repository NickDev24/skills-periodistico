---
name: anti-saturacion
description: Detecta duplicados, noticias ya cubiertas, reformulaciones sin novedad y oportunidades reales de actualización o exclusividad.
---

# Anti-saturación

Antes de producir una nueva pieza, comparar contra las candidatas y publicaciones recientes disponibles.

## Comparar

- mismo hecho;
- mismas personas;
- mismo lugar;
- mismo momento;
- misma fuente;
- mismas cifras;
- mismo video o imagen;
- mismo evento con nueva información.

## Clasificación

- DUPLICADO: no aporta información nueva.
- ACTUALIZACIÓN: mismo hecho, pero cambió un dato relevante.
- PROFUNDIZACIÓN: mismo hecho, nueva evidencia o contexto útil.
- NUEVA NOTICIA: hecho distinto.
- EXCLUSIVA: información propia que no aparece en las fuentes comparadas.

## Regla

No publiques una reformulación como si fuera una novedad.

Si el hecho está saturado pero apareció una consecuencia nueva, titular la novedad, no repetir el acontecimiento original.

## Salida

{
  "estado": "duplicado|actualizacion|profundizacion|nueva_noticia|exclusiva",
  "similitud": 0,
  "novedad_real": 0,
  "que_cambio": "",
  "publicar": true
}
