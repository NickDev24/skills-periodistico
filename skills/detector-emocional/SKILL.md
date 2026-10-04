---
name: detector-emocional
description: Clasificación de emoción y motivación periodística para elegir enfoque, tono y formato sin fabricar intensidad, con detección de riesgo de manipulación.
---

# Detector emocional periodístico

Identificá la emoción dominante que surge del hecho o de su consecuencia probable.

## Categorías

- sorpresa
- curiosidad
- preocupación
- indignación
- alegría
- esperanza
- tristeza
- miedo
- alivio
- orgullo_local
- identificación
- humor
- urgencia
- utilidad

## Reglas

1. Separá emoción del hecho de emoción editorial.
2. No agregues "indignación" solo porque el tema es político.
3. No conviertas tragedia en entretenimiento.
4. No uses miedo como recurso si la fuente no respalda el riesgo.
5. En información de servicio, utilidad y urgencia pueden ser más importantes que emoción.
6. Una noticia puede tener varias emociones: elegí una dominante y hasta dos secundarias.

## Salida

{
  "dominante": "",
  "secundarias": [],
  "intensidad": 0,
  "evidencia": "",
  "uso_editorial": "angulo|tono|formato",
  "riesgo_manipulacion": 0
}
