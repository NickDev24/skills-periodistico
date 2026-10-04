# skill-periodistico 1.0.0 (FENIX)

**Agente periodístico completo para IA**: criterio, decisión, verificación y redacción, con integración real a **Radar Notiviral (API FENIX)** — la API de noticias de Argentina con señales periodísticas de las 23 provincias.

La idea no es darle al agente un "prompt para escribir noticias", sino un **modelo de comportamiento**:

`verificar → detectar novedad → puntuar → elegir ángulo → elegir formato → titular → redactar → autocontrol → publicar/abstenerse`

Y ahora, con Radar Notiviral, el ciclo empieza con señales reales:

`radar → señales (clusters, primicias, huérfanas, gaps) → triaje → score → redacción`

## Qué es nuevo en 1.0.0

- **Integración con Radar Notiviral (API FENIX)**: cliente completo de los 12+ endpoints, con rate limiting, cache y normalización de HTML a texto plano.
- **Generación de piezas con LLM**: conectá OPENAI, GROQ u OPENROUTER y generá la pieza completa (radar → prompt → modelo → JSON).
- **Pipeline de redacción**: `radar → triaje → score → prompt` en un solo comando.
- **9 skills nuevos**: `radar-notiviral`, `verificacion-fuentes`, `etica-legal`, `datos-y-cifras`, `multicanal`, `agenda-propria`, `cobertura-crisis`, `seo-noticias`, `integracion-llm`.
- **8 tareas nuevas**: `radar-digest`, `gap-alerta`, `cluster-seguimiento`, `primicia-nota`, `verificacion-nota`, `servicio-util`, `hilo-x`, `newsletter-bloque`.
- **3 voces nuevas**: `datos-frio`, `alerta-servicio`, `analisis-corto`.
- **Módulo de verificación**: escala N1-N6 ejecutable, 6 preguntas de prueba, verificación de cifras, detección de alertas y control final.
- **20 casos adversariales** en evals (vs 8 en las versiones anteriores).
- **Comandos CLI nuevos**: `radar`, `señales`, `gaps`, `pipeline`, `generar`, `digesto`, `verificar`, `keys`.

## Instalación

```bash
# Instala los skills en ./.claude/skills (Claude Code y compatibles)
npx skill-periodistico install

# Para agentes que leen ./.agents/skills
npx skill-periodistico install --target agents

# Carpeta a elección
npx skill-periodistico install --dest ./mis-skills
```

Como librería:

```bash
npm install skill-periodistico
```

## Configurar Radar Notiviral

La API key se provee por el encabezado `X-API-Key`. Conseguila gratis en https://radar-notiviral.online/registro (plan gratis: 30 requests/minuto).

Configurala de cualquiera de estas formas (nunca la escribas en el código):

```bash
# Variable de entorno
export FENIX_KEY="tu_key"

# O archivo en tu home
echo "tu_key" > ~/.fenix-key

# O por flag en cada comando
npx skill-periodistico radar --key "tu_key"
```

## Configurar el LLM (obligatorio para generar piezas)

**Sin una de estas keys, el agente solo arma prompts y no puede producir contenido.**

| Proveedor | Variable | Modelo default |
|---|---|---|
| OPENAI | `OPENAI_KEY` | gpt-4o-mini |
| GROQ | `GROQ_KEY` | llama-3.3-70b-versatile |
| OPENROUTER | `OPENROUTER_KEY` | meta-llama/llama-3.3-70b-instruct:free |

```bash
# Elegí al menos uno
export OPENAI_KEY="sk-..."
export GROQ_KEY="gsk_..."
export OPENROUTER_KEY="sk-or-..."

# Verificá qué está configurado
npx skill-periodistico keys
```

También podés guardar la key en `~/.config/skill-periodistico/<proveedor>.key` o pasarla con `--key`.

## Skills (20)

| Skill | Función |
|---|---|
| `periodista-criterio` | Núcleo: escala de evidencia N1-N6, 6 preguntas de prueba, abstención, personalidad, sensibilidad |
| `titulares-impacto` | Fórmulas, límites por canal, test de la promesa, anti-clickbait |
| `redaccion-narrativa` | Estructura, ritmo, retención en texto y video, voseo |
| `narrativa-video` | Retención para reels, shorts y clips |
| `audiencia-argentina` | Qué consume y qué evita la audiencia, con fuentes y límites |
| `contexto-salta` | Plantilla de contexto local para completar y validar |
| `formatos-salida` | Contratos JSON de las 15 tareas |
| `psicologia-atencion` | Relevancia, curiosidad, utilidad, novedad y tensión factual |
| `score-editorial` | Score 0-100 para ordenar candidatas |
| `detector-emocional` | Emoción dominante y riesgo de manipulación |
| `anti-saturacion` | Duplicado, actualización, profundización, nueva noticia o exclusiva |
| `aprendizaje-audiencia` | Aprender de métricas reales del medio |
| `radar-notiviral` | **NUEVO** — Cómo leer las señales de la API: clusters, primicias, huérfanas, gaps, reloj, mapa |
| `verificacion-fuentes` | **NUEVO** — Checklist de verificación por tipo de material, deepfakes, IA |
| `etica-legal` | **NUEVO** — Ley 11.723, derecho de réplica, presunción de inocencia, menores |
| `datos-y-cifras` | **NUEVO** — Cifras con fuente, período y denominador; trampas estadísticas |
| `multicanal` | **NUEVO** — Adaptación por canal sin cambiar los hechos |
| `agenda-propria` | **NUEVO** — Construir agenda desde gaps y huérdanas |
| `cobertura-crisis` | **NUEVO** — Emergencias, alertas y desastres con precisión |
| `seo-noticias` | **NUEVO** — SEO periodístico sin clickbait |
| `integracion-llm` | **NUEVO** — Conectar OPENAI, GROQ y OPENROUTER para generar piezas |

## Tareas (15)

| Tarea | Para qué |
|---|---|
| `reel` | Noticia a video corto (gancho ≤12 palabras, locución 20-45 s) |
| `placa` | Imagen + post (titular MAYÚSCULAS ≤14 palabras) |
| `articulo` | Lectura profunda (título ≤90 car., 2-6 bloques) |
| `opinion` | Columna sobre un clip (40-70 palabras, separada de los hechos) |
| `meme` | Humor sobre situación pública no sensible |
| `curador` | Elegir 1 candidata de una lista |
| `formato-post` | Instrucción editorial para otro redactor |
| `radar-digest` | **NUEVO** — Digesto de las señales del radar |
| `gap-alerta` | **NUEVO** — Oportunidad de reportaje desde un gap |
| `cluster-seguimiento` | **NUEVO** — Seguimiento de nota en expansión |
| `primicia-nota` | **NUEVO** — Nota sobre primicia con crédito "primero informó X" |
| `verificacion-nota` | **NUEVO** — Fact-check con veredicto claro |
| `servicio-util` | **NUEVO** — Nota de servicio accionable |
| `hilo-x` | **NUEVO** — Hilo de X/Twitter (5-10 tuits) |
| `newsletter-bloque` | **NUEVO** — Bloque de newsletter (3-5 ítems) |

## Voces (7)

`urbano-agil` · `cercano-local` · `institucional-serio` · `cronista-calido` · `datos-frio` · `alerta-servicio` · `analisis-corto`

## CLI

```bash
npx skill-periodistico list
npx skill-periodistico skill periodista-criterio
npx skill-periodistico score --proximidad_local 90 --novedad 80 --verificabilidad 100 --json
npx skill-periodistico prompt reel --medio "Mi Medio" --voz urbano-agil
npx skill-periodistico keys

# Radar Notiviral (requiere FENIX_KEY o --key)
npx skill-periodistico radar --provincia AR-A --ventana 6h --orden velocidad
npx skill-periodistico señales --provincia AR-A --ventana 6h
npx skill-periodistico gaps --provincia AR-A --ventana 24h
npx skill-periodistico pipeline placa --provincia AR-A --ventana 6h --medio "Mi Medio"
npx skill-periodistico digesto --provincia AR-A --ventana 6h
npx skill-periodistico verificar --afirmacion "Subió 40%" --material '{"fuente":"vecino"}'

# Generar pieza completa (requiere OPENAI_KEY, GROQ_KEY u OPENROUTER_KEY)
npx skill-periodistico generar placa --provincia AR-A --ventana 6h --proveedor groq
npx skill-periodistico generar articulo --provincia AR-A --proveedor openai --modelo gpt-4o
npx skill-periodistico generar reel --provincia AR-A --proveedor openrouter --modelo google/gemini-flash-1.5
```

## API como librería

```js
const { ApiFenix } = require('skill-periodistico/src/api.js');
const { escanearRadar, senalesDelMomento, prepararPieza, digestoRadar } = require('skill-periodistico/src/pipeline.js');
const { scoreEditorial, decidirEditorial } = require('skill-periodistico');

// Cliente de Radar Notiviral (lee FENIX_KEY del env o ~/.fenix-key)
const api = new ApiFenix({});

// ¿Qué se está expandiendo ahora en Salta?
const radar = await escanearRadar({ provincia: 'AR-A', ventana: '6h', orden: 'velocidad' }, api);
console.log(radar.candidatas[0]); // candidata triada con score y señales

// Señales del momento
const senales = await senalesDelMomento({ provincia: 'AR-A', ventana: '6h' }, api);

// Preparar una pieza lista para el modelo
const pieza = prepararPieza({ item: radar.candidatas[0], tarea: 'placa', vars: { nombre_medio: 'Mi Medio' } });
// pieza.prompt.system y pieza.prompt.user van a tu modelo

// Motor editorial (determinista, sin dependencias)
const decision = decidirEditorial({ proximidad_local: 95, actualidad: 90, verificabilidad: 100, riesgo: 5, nivel_evidencia: 'N2' });
```

## Verificación como librería

```js
const { clasificarEvidencia, preguntasPrueba, verificarCifra, detectarAlertas, controlFinal } = require('skill-periodistico/src/verificacion.js');

clasificarEvidencia({ prueba: 'documento' });        // N1
clasificarEvidencia({ quien_dice: 'un vecino' });    // N4
verificarCifra({ valor: '40%', fuente: 'vecino' });  // alertas: período y denominador
controlFinal({ invento_datos: false });                // aprobado: true
```

## LLM como librería

```js
const { generar, generarJson, estadoKeys } = require('skill-periodistico/src/llm.js');

estadoKeys(); // qué proveedores están configurados

// Generar con el proveedor detectado (OPENAI > GROQ > OPENROUTER)
const r = await generarJson({
  system: 'Sos un periodista de Mi Medio...',
  user: 'Redactá la nota...',
});
console.log(r.json); // objeto parseado

// Con proveedor y modelo explícitos
const r2 = await generar({
  proveedor: 'groq',
  modelo: 'llama-3.3-70b-versatile',
  system: '...', user: '...', temperature: 0.3,
});
```

## Pruebas

```bash
npm test
```

Valida skills, voces, plantillas, motor editorial, verificación, normalización de la API y evals. Los casos adversariales cubren denuncias, fuentes anónimas, cifras sin denominador, tragedias, información insuficiente, opinión sobre víctimas, selección por frescura/fuente, huérfanas como exclusivas, clusters saturados, gaps sin ángulo, contenido IA, presunción de inocencia, versiones contradictorias, menores identificables y más.

## Señales de Radar Notiviral

| Señal | Qué es | Uso editorial |
|---|---|---|
| Ítem | Nota indexada con metadata | Materia prima |
| Cluster | Misma noticia replicada en 2+ medios | El tema se está haciendo nacional |
| Primicia | La fuente que publicó primero | Citar "primero informó X" |
| Huérfana | Una sola fuente, nadie replicó | Posible exclusiva propia |
| Gap | Tema nacional sin cobertura local | Oportunidad de reportaje |
| Reloj | Minutos entre primicia y cada réplica | Velocidad de cada medio |
| Mapa | Pulso provincial | Dónde está el pulso |

**Regla de oro**: la API agrupa y señala, pero no verifica por vos. Cada ítem sigue pasando por el criterio periodístico. Una huérfana es una oportunidad, no una verdad.

## Personalizar

1. Completá `skills/contexto-salta/SKILL.md` con tus medios, fuentes oficiales, calendario y topónimos.
2. Agregá voces en `voces/*.md` (formato: RASGOS, RITMO, LÉXICO, HACE, NO HACE, EJEMPLO).
3. Ajustá las plantillas en `plantillas/*.md`. Variables con `{{doble_llave}}`.
4. Contrastá `audiencia-argentina` con tu propia analítica y actualizá las cifras cada año con el Digital News Report.
5. Recalibrá los pesos del score con `aprendizaje-audiencia` y tus métricas reales.

## Aviso

Este material es una guía editorial, no asesoramiento legal. Citar siempre la fuente original y consultar a un abogado de medios ante dudas de propiedad intelectual (Ley 11.723 en Argentina).

Radar Notiviral es un servicio externo; su uso está sujeto a sus términos y a los límites de tu plan.

## Licencia

MIT
