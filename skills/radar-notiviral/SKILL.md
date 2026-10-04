---
name: radar-notiviral
description: Cómo leer las señales de Radar Notiviral (API FENIX): ítems, clusters en expansión, primicias, huérfanas, gaps de cobertura, reloj de la noticia, mapa de calor y catálogo de fuentes. Usar para alimentar la agenda con señales reales.
---

# Radar Notiviral (API FENIX)

Fuente: https://radar-notiviral.online — API pública REST, JSON, con señales periodísticas de las 23 provincias argentinas. Autenticación: encabezado `X-API-Key` (clave gratis en /registro; plan gratis 30 req/min).

## Las señales y qué significan

| Señal | Qué es | Uso editorial |
|---|---|---|
| Ítem | Nota indexada con metadata | Materia prima |
| Cluster | Misma noticia replicada en 2+ medios | El tema se está haciendo nacional |
| Primicia | La fuente que publicó primero | Citar "primero informó X" |
| Huérfana | Una sola fuente, nadie replicó | Posible exclusiva propia |
| Gap | Tema nacional sin cobertura local | Oportunidad de reportaje |
| Reloj | Minutos entre primicia y cada réplica | Velocidad de cada medio |
| Mapa | Pulso provincial | Dónde está el pulso |

## Endpoints clave

- `GET /api/v1/items` — filtros: provincia (AR-A), region (NOA), tema, tipo, ventana (15m|1h|6h|24h|48h), min/max score, search, clusters, huerfanas, primicia, gap, min_fuentes, sin_video, orden (fecha|n_fuentes|velocidad), page, page_size (máx 100)
- `GET /api/v1/items/{id}` — detalle completo
- `GET /api/v1/clusters` — min_fuentes, ventana, region, provincia, limit
- `GET /api/v1/reloj` — ventana, limite
- `GET /api/v1/gaps` — ventana, provincia, limit
- `GET /api/v1/primicias` — ventana, limit
- `GET /api/v1/huerfanas` — ventana, provincia, limit
- `GET /api/v1/mapa` — ventana
- `GET /api/v1/sources` — tipo, provincia, region, canonico, canal
- `GET /api/v1/buscar` — q, ventana, provincia, tema, limite
- `GET /api/v1/quotes` — ventana, provincia, tema, hablante, limite
- `GET /api/v1/keys/me` y `/api/v1/quotas` — cuenta y consumo
- `GET /api/v1/health` — estado, sin auth

## Reglas de uso

- La API agrupa y señala; no verifica por vos. Cada ítem sigue pasando por el criterio periodístico.
- Una huérfana es una oportunidad, no una verdad: verificar antes de publicar.
- Un cluster indica expansión, no importancia: aplicar score editorial.
- Los campos `bajada` y `contenido_texto` vienen con HTML: normalizar antes de citar.
- Citar siempre la fuente original (fuente_origen) y enlazar al ítem cuando corresponda.
- Respetar el rate limit del plan (30 req/min en el gratis): cachear y paginar.
- El campo `ia_match` señala posible contenido generado por IA: verificar origen antes de citarlo como evidencia.

## Códigos de provincia (ISO AR-X)

AR-A Salta · AR-B Buenos Aires · AR-C Capital Federal · AR-D Catamarca · AR-E Entre Ríos · AR-F Formosa · AR-G Santiago del Estero · AR-H Jujuy · AR-I La Pampa · AR-J La Rioja · AR-K Mendoza · AR-L Misiones · AR-M Neuquén · AR-N Río Negro · AR-O Salta (alternativo) · AR-P Formosa (alternativo) · AR-Q San Juan · AR-R San Luis · AR-S Santa Fe · AR-T Tucumán · AR-U Chubut · AR-V Tierra del Fuego · AR-W Corrientes · AR-X Chaco · AR-Y Santa Cruz · NAC Nacional

> Verificar el código exacto con `/api/v1/mapa` o `/api/v1/sources` antes de filtrar.
