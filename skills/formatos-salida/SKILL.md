---
name: formatos-salida
description: Contratos de cada pieza (reel, placa, artículo, opinión, meme, curador, radar-digest, gap-alerta, cluster-seguimiento, primicia-nota, verificacion-nota, servicio-util, hilo-x, newsletter-bloque): límites, campos JSON y reglas propias. Usar al producir cualquiera de esos formatos.
---

# Formatos de salida

Todos los formatos devuelven SOLO JSON plano (sin ```json ni texto alrededor). Las plantillas completas están en `plantillas/`.

| Formato | Cuándo | Límites clave | Campos |
|---|---|---|---|
| Reel | Noticia a video corto | Gancho ≤12 palabras; locución 50-100 palabras (20-45 s); caption FB ≤350 car. | gancho_viral, guion_voz, dato_clave, contexto, cierre, caption_facebook, video_prompt_ingles, alertas |
| Placa | Imagen + post | Titular MAYÚSCULAS ≤14 palabras / 90 car.; bajada ≤140 car.; cuerpo 600-1500 car. | titulo, subtitulo, cuerpo, enfoque, verificacion, motivo |
| Artículo | Lectura profunda | Título ≤90 car.; entradilla ≤280 car.; 2-6 bloques de 2-4 oraciones | titulo, entradilla, bloques, fuentes |
| Opinión | Columna sobre un clip | 40-70 palabras, 2-3 frases; separada de los hechos | opinion, motivo, hechos, lectura_editorial, punto_discutible, certeza |
| Meme | Humor sobre situación pública y no sensible | Titular ≤60 car.; bajada ≤90 car. | es_meme, plantilla, titular, bajada, pie, copy, motivo, riesgo |
| Curador | Elegir 1 candidata | Solo de la lista; 0 = ninguna | elegir, razon, riesgos, confianza |
| Radar-digest | Resumen del radar | 5-8 ítems, uno por línea | titulo, items, senales, proximos_pasos |
| Gap-alerta | Oportunidad de cobertura | 1 gap por alerta | tema, provincia, porque_importa, angulo_sugerido, fuentes_a_consultar |
| Cluster-seguimiento | Nota en expansión | seguimiento de 1 cluster | cluster_id, titulo, n_fuentes, cadena, que_cambio, angulo |
| Primicia-nota | Nota sobre primicia | crédito "primero informó X" | titulo, entradilla, bloques, primicia_fuente, credito |
| Verificacion-nota | Fact-check | veredicto claro | afirmacion, veredicto, evidencia, fuentes, contexto |
| Servicio-util | Nota de servicio | acción concreta | titulo, que_cambia, como_actuar, fuentes, vigencia |
| Hilo-x | Hilo de X/Twitter | 5-10 tuits, hilo | titulo, tuits, fuente, credito |
| Newsletter-bloque | Bloque de newsletter | 3-5 ítems | bloque, items, cierre |

## Reglas transversales
- Abstención válida: `{"publicar": false, "motivo": "..."}` (o `elegir: 0`, `es_meme: false`, opinión vacía).
- El formato cambia la presentación, nunca los hechos. Si hay conflicto, gana la precisión.
- Si el formato obliga a distorsionar: responder "FORMATO INCOMPATIBLE CON LA INFORMACIÓN DISPONIBLE".
- Crédito de la fuente original siempre presente en la publicación final (pie o caption).
- Toda pieza lleva trazabilidad: fuente, fecha de publicación de la fuente, y señales del radar cuando corresponda.
