---
name: integracion-llm
description: Cómo conectar el agente a modelos de lenguaje (OPENAI, GROQ, OPENROUTER) para generar piezas. Sin una de estas keys, el agente solo arma prompts y no puede producir contenido.
---

# Integración LLM (OPENAI · GROQ · OPENROUTER)

El agente necesita una API key de un proveedor de modelos para **generar** piezas.
Sin ella, solo arma prompts (system + user) que vos llevás a tu modelo.

## Proveedores soportados

| Proveedor | Variable de entorno | Modelo default | Endpoint |
|---|---|---|---|
| OPENAI | `OPENAI_KEY` | gpt-4o-mini | api.openai.com/v1/chat/completions |
| GROQ | `GROQ_KEY` | llama-3.3-70b-versatile | api.groq.com/openai/v1/chat/completions |
| OPENROUTER | `OPENROUTER_KEY` | meta-llama/llama-3.3-70b-instruct:free | openrouter.ai/api/v1/chat/completions |

Los tres usan el formato de OpenAI (messages[]), así que cambiar de proveedor
es solo cambiar la key y (opcionalmente) el modelo.

## Cómo configurar la key

Tres formas (de mayor a menor prioridad):

```bash
# 1. Variable de entorno (recomendada)
export OPENAI_KEY="sk-..."
export GROQ_KEY="gsk_..."
export OPENROUTER_KEY="sk-or-..."

# 2. Archivo por proveedor
mkdir -p ~/.config/skill-periodistico
echo "tu_key" > ~/.config/skill-periodistico/groq.key

# 3. Flag en cada comando
npx skill-periodistico generar placa --proveedor groq --key "tu_key"
```

## Verificar qué está configurado

```bash
npx skill-periodistico keys
```

Muestra qué proveedores tienen key y cuál es el proveedor activo.
Si ninguno está configurado, el agente avisa que solo puede armar prompts.

## Generar una pieza completa

```bash
# Radar → triaje → score → prompt → modelo → JSON
npx skill-periodistico generar placa --provincia AR-A --ventana 6h --proveedor groq

# Con modelo específico
npx skill-periodistico generar articulo --provincia AR-A --proveedor openai --modelo gpt-4o

# Con OpenRouter (modelos free y de pago)
npx skill-periodistico generar reel --provincia AR-A --proveedor openrouter --modelo google/gemini-flash-1.5
```

## Desde la librería

```js
const { generar, generarJson, estadoKeys } = require('skill-periodistico/src/llm.js');

// Estado de las keys
estadoKeys(); // { openai: {configurada: true, ...}, groq: {...}, openrouter: {...} }

// Generar con el proveedor detectado automáticamente
const r = await generarJson({
  system: 'Sos un periodista...',
  user: 'Redactá la nota...',
});
console.log(r.json); // objeto parseado de la respuesta

// O con proveedor explícito
const r2 = await generar({
  proveedor: 'groq',
  modelo: 'llama-3.3-70b-versatile',
  system: '...',
  user: '...',
  temperature: 0.3,
});
```

## Reglas

- La key nunca se escribe en el código ni se commitea: solo env, archivo de config o flag.
- El proveedor se detecta automáticamente por la key disponible (OPENAI > GROQ > OPENROUTER).
- Si el modelo devuelve texto en vez de JSON, el cliente extrae el JSON del bloque ```json o del primer {...}.
- Ante error 401: la key está mal o no tiene crédito. Ante 429: rate limit, esperá y reintentá.
- El score editorial y la verificación corren **antes** del modelo: el LLM no reemplaza el criterio.
