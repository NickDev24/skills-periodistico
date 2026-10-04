'use strict';
/**
 * Cliente LLM multi-proveedor para skill-periodistico.
 *
 * Soporta (con la API key correspondiente):
 *  - OPENAI     (OPENAI_KEY)     → api.openai.com/v1/chat/completions
 *  - GROQ       (GROQ_KEY)       → api.groq.com/openai/v1/chat/completions
 *  - OPENROUTER (OPENROUTER_KEY) → openrouter.ai/api/v1/chat/completions
 *
 * Los tres usan el formato de OpenAI (messages[]). El proveedor se
 * elige con --proveedor o se detecta por la key disponible.
 * Sin una de estas keys, el agente no puede generar piezas: solo
 * arma prompts.
 */
const https = require('https');

const PROVEEDORES = {
  openai: {
    base: 'https://api.openai.com/v1/chat/completions',
    env: 'OPENAI_KEY',
    modelos: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    modelo_default: 'gpt-4o-mini',
    header: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  groq: {
    base: 'https://api.groq.com/openai/v1/chat/completions',
    env: 'GROQ_KEY',
    modelos: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
    modelo_default: 'llama-3.3-70b-versatile',
    header: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  openrouter: {
    base: 'https://openrouter.ai/api/v1/chat/completions',
    env: 'OPENROUTER_KEY',
    modelos: ['openai/gpt-4o-mini', 'meta-llama/llama-3.3-70b-instruct:free', 'google/gemini-flash-1.5', 'anthropic/claude-3.5-haiku'],
    modelo_default: 'meta-llama/llama-3.3-70b-instruct:free',
    header: (key) => ({
      Authorization: `Bearer ${key}`,
      'HTTP-Referer': 'https://radar-notiviral.online',
      'X-Title': 'skill-periodistico',
    }),
  },
};

class LLMError extends Error {
  constructor(status, body) {
    super(typeof body === 'string' ? body : `HTTP ${status}`);
    this.name = 'LLMError';
    this.status = status;
    this.body = body;
  }
}

function requestJson(url, { method = 'POST', headers, body, timeout = 120000 } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request(u, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...headers,
      },
      timeout,
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch { /* no JSON */ }
        if (res.statusCode >= 400) {
          const msg = json && json.error ? (json.error.message || json.error) : (json && json.detail ? json.detail : `HTTP ${res.statusCode}`);
          reject(new LLMError(res.statusCode, msg));
          return;
        }
        resolve(json);
      });
    });
    req.on('timeout', () => { req.destroy(new LLMError(408, 'timeout')); });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

/** Resuelve la key del proveedor: flag > env > ~/.config/skill-periodistico/<proveedor>.key */
function resolveKey(proveedor, explicit) {
  const p = PROVEEDORES[proveedor];
  if (!p) throw new Error(`proveedor desconocido: ${proveedor}. Usá uno de: ${Object.keys(PROVEEDORES).join(', ')}`);
  if (explicit) return explicit;
  if (process.env[p.env]) return process.env[p.env];
  try {
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const file = path.join(os.homedir(), '.config', 'skill-periodistico', `${proveedor}.key`);
    if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim();
  } catch { /* sin archivo de key */ }
  return null;
}

/** Detecta qué proveedor está configurado (por key disponible). */
function detectarProveedor() {
  for (const [nombre, p] of Object.entries(PROVEEDORES)) {
    if (process.env[p.env]) return nombre;
  }
  return null;
}

/** Lista las keys configuradas (sin revelarlas). */
function estadoKeys() {
  const estado = {};
  for (const [nombre, p] of Object.entries(PROVEEDORES)) {
    estado[nombre] = {
      env: p.env,
      configurada: Boolean(process.env[p.env] || resolveKey(nombre)),
      modelo_default: p.modelo_default,
    };
  }
  return estado;
}

/**
 * Llama al modelo con messages y devuelve el texto de la respuesta.
 * @param {object} o
 * @param {string} o.proveedor openai|groq|openrouter
 * @param {string} [o.modelo] modelo (default del proveedor si no)
 * @param {string} o.system prompt del sistema
 * @param {string} o.user mensaje del usuario
 * @param {number} [o.temperature] 0-2 (default 0.3)
 * @param {number} [o.max_tokens]
 * @param {string} [o.key] key explícita
 */
async function generar({ proveedor, modelo, system, user, temperature = 0.3, max_tokens, key } = {}) {
  if (!proveedor) proveedor = detectarProveedor();
  if (!proveedor) {
    throw new LLMError(401, 'Sin proveedor LLM configurado. Definí OPENAI_KEY, GROQ_KEY u OPENROUTER_KEY (o usá --proveedor y --key).');
  }
  const p = PROVEEDORES[proveedor];
  const apiKey = resolveKey(proveedor, key);
  if (!apiKey) {
    throw new LLMError(401, `Sin API key para ${proveedor}. Definí ${p.env}, guardala en ~/.config/skill-periodistico/${proveedor}.key o usá --key.`);
  }
  const model = modelo || p.modelo_default;
  const body = {
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature,
  };
  if (max_tokens) body.max_tokens = max_tokens;

  const res = await requestJson(p.base, { headers: p.header(apiKey), body });
  const texto = res && res.choices && res.choices[0] && res.choices[0].message
    ? res.choices[0].message.content
    : null;
  if (!texto) throw new LLMError(500, `respuesta inesperada del proveedor: ${JSON.stringify(res).slice(0, 300)}`);
  return { proveedor, modelo: model, texto, uso: res.usage || null, raw: res };
}

/**
 * Genera y extrae JSON de la respuesta (las plantillas piden "SOLO JSON").
 * Tolera bloques ```json ... ``` y texto alrededor.
 */
async function generarJson(opts) {
  const r = await generar(opts);
  const json = extraerJson(r.texto);
  return { ...r, json };
}

function extraerJson(texto) {
  if (!texto) return null;
  const limpio = texto.trim();
  // Intentar parseo directo
  try { return JSON.parse(limpio); } catch { /* no es JSON puro */ }
  // Buscar bloque ```json ... ``` o ``` ... ```
  const m = limpio.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (m) {
    try { return JSON.parse(m[1].trim()); } catch { /* no JSON */ }
  }
  // Buscar el primer { ... } balanceado
  const start = limpio.indexOf('{');
  const end = limpio.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try { return JSON.parse(limpio.slice(start, end + 1)); } catch { /* no JSON */ }
  }
  return null;
}

module.exports = {
  PROVEEDORES, LLMError,
  generar, generarJson, extraerJson,
  resolveKey, detectarProveedor, estadoKeys,
};
