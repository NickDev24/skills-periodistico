'use strict';
/**
 * Cliente de Radar Notiviral (API FENIX) — https://radar-notiviral.online
 *
 * Señales periodísticas de las 23 provincias argentinas:
 * ítems, clusters (notas en expansión), primicias, huérfanas (posibles
 * exclusivas), gaps (vacíos de cobertura), reloj de la noticia, mapa de
 * calor, catálogo de fuentes, búsqueda y citas textuales.
 *
 * La API key se provee por el encabezado X-API-Key. Nunca se escribe en
 * código: se lee de FENIX_KEY (env), del archivo ~/.fenix-key o del
 * argumento --key. Plan gratis: 30 requests/minuto.
 */
const https = require('https');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE_URL = process.env.FENIX_BASE_URL || 'https://radar-notiviral.online';
const PLAN_RPM = 30; // requests por minuto del plan gratis

const VENTANAS = new Set(['15m', '1h', '6h', '24h', '48h', '7d']);
const TEMAS = new Set(['seguridad', 'politica', 'servicio', 'economia', 'deportes', 'cultura', 'general']);
const ORDEN_ITEMS = new Set(['fecha', 'n_fuentes', 'velocidad']);
const TIPO_ITEM = new Set(['editorial', 'youtube']);

class ApiFenixError extends Error {
  constructor(status, body) {
    super(typeof body === 'string' ? body : `HTTP ${status}`);
    this.name = 'ApiFenixError';
    this.status = status;
    this.body = body;
  }
}

function request(method, urlPath, { apiKey, timeout = 20000 } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
    const headers = { Accept: 'application/json' };
    if (apiKey) headers['X-API-Key'] = apiKey;
    const req = (url.protocol === 'https:' ? https : http).request(url, { method, headers, timeout }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch { /* respuesta no JSON */ }
        if (res.statusCode >= 400) {
          const msg = json && json.detail ? json.detail : `HTTP ${res.statusCode}`;
          reject(new ApiFenixError(res.statusCode, msg));
          return;
        }
        resolve(json);
      });
    });
    req.on('timeout', () => { req.destroy(new ApiFenixError(408, 'timeout')); });
    req.on('error', reject);
    req.end();
  });
}

/** Rate limiter simple por ventana deslizante de 60s. */
function createLimiter(rpm = PLAN_RPM) {
  const stamps = [];
  return {
    async wait() {
      const now = Date.now();
      while (stamps.length && now - stamps[0] > 60000) stamps.shift();
      if (stamps.length >= rpm) {
        const waitMs = 60000 - (now - stamps[0]) + 50;
        await new Promise((r) => setTimeout(r, waitMs));
        return this.wait();
      }
      stamps.push(Date.now());
    },
  };
}

function resolveApiKey(explicit) {
  if (explicit) return explicit;
  if (process.env.FENIX_KEY) return process.env.FENIX_KEY;
  try {
    const p = path.join(os.homedir(), '.fenix-key');
    if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim();
  } catch { /* sin archivo de key */ }
  return null;
}

function cleanHtml(html) {
  if (!html) return '';
  return String(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Normaliza un ítem crudo de la API a un objeto plano y útil. */
function normalizeItem(it) {
  if (!it) return null;
  return {
    id: it.id,
    titulo: it.titulo || '',
    bajada: cleanHtml(it.bajada),
    contenido: cleanHtml(it.contenido_texto),
    url: it.url,
    imagen_url: it.imagen_url || null,
    video_url: it.video_url || null,
    fuente_id: it.fuente_id || null,
    fuente_origen: it.fuente_origen || '',
    tipo: it.tipo || 'editorial',
    provincia: it.provincia || null,
    region: it.region || null,
    territorio: it.territorio || null,
    tema: it.tema || 'general',
    publicado_en: it.publicado_en || null,
    creado_en: it.created_at || null,
    cluster_id: it.cluster_id || null,
    n_fuentes: it.n_fuentes || 1,
    es_primicia: !!it.es_primicia,
    es_huerfana: !!it.es_huerfana,
    es_gap: !!it.es_gap,
    velocidad_min: it.velocidad_min || 0,
    fuera_de_foco: !!it.fuera_de_foco,
    ia_match: !!it.ia_match,
  };
}

function qs(params) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

function validateVentana(v) {
  if (v && !VENTANAS.has(v)) throw new Error(`ventana inválida: ${v}. Usá una de: ${[...VENTANAS].join(', ')}`);
  return v;
}
function validateTema(t) {
  if (t && !TEMAS.has(t)) throw new Error(`tema inválido: ${t}. Usá uno de: ${[...TEMAS].join(', ')}`);
  return t;
}

class ApiFenix {
  constructor({ apiKey, rpm, timeout } = {}) {
    this.apiKey = resolveApiKey(apiKey);
    this.limiter = createLimiter(rpm || PLAN_RPM);
    this.timeout = timeout;
    this._cache = new Map();
  }

  get keyConfigured() { return Boolean(this.apiKey); }

  async _get(path, { cacheMs = 0 } = {}) {
    await this.limiter.wait();
    if (cacheMs > 0 && this._cache.has(path)) {
      const hit = this._cache.get(path);
      if (Date.now() - hit.ts < cacheMs) return hit.data;
    }
    const data = await request('GET', path, { apiKey: this.apiKey, timeout: this.timeout });
    if (cacheMs > 0) this._cache.set(path, { ts: Date.now(), data });
    return data;
  }

  /** Salud del servicio (no requiere key). */
  health() { return request('GET', '/api/v1/health', {}); }

  /** Cuenta y estado de la key. */
  me() { return this._get('/api/v1/keys/me'); }

  /** Consumo del día y límites. */
  quotas() { return this._get('/api/v1/quotas'); }

  /**
   * Ítems del radar. Filtros combinables: provincia (AR-A), region (NOA),
   * tema, tipo, ventana, min/max score, search, fecha_desde/hasta, fuente,
   * territorio, nicho, clusters, huerfanas, primicia, gap, min_fuentes,
   * sin_video, orden (fecha|n_fuentes|velocidad), page, page_size (máx 100).
   */
  async items(f = {}) {
    validateVentana(f.ventana);
    validateTema(f.tema);
    if (f.orden && !ORDEN_ITEMS.has(f.orden)) throw new Error(`orden inválido: ${f.orden}`);
    if (f.tipo && !TIPO_ITEM.has(f.tipo)) throw new Error(`tipo inválido: ${f.tipo}`);
    const p = qs({
      page: f.page || 1, page_size: Math.min(f.page_size || 50, 100),
      fuente: f.fuente, territorio: f.territorio, nicho: f.nicho,
      min_score: f.min_score, max_score: f.max_score, search: f.search,
      fecha_desde: f.fecha_desde, fecha_hasta: f.fecha_hasta,
      provincia: f.provincia, region: f.region, tipo: f.tipo, tema: f.tema,
      clusters: f.clusters, huerfanas: f.huerfanas, primicia: f.primicia,
      gap: f.gap, min_fuentes: f.min_fuentes, ventana: f.ventana,
      sin_video: f.sin_video, orden: f.orden,
    });
    const raw = await this._get(`/api/v1/items${p}`, { cacheMs: f.cacheMs });
    return {
      data: (raw.data || []).map(normalizeItem),
      pagination: raw.pagination,
      filters: raw.filters,
    };
  }

  /** Detalle completo de una nota por id. */
  async item(id) {
    if (!id) throw new Error('falta el id del ítem');
    const raw = await this._get(`/api/v1/items/${encodeURIComponent(id)}`);
    return normalizeItem(raw);
  }

  /** Notas en expansión: misma noticia creciendo en varios medios. */
  async clusters(f = {}) {
    validateVentana(f.ventana);
    validateTema(f.tema);
    const p = qs({ min_fuentes: f.min_fuentes || 2, ventana: f.ventana || '24h', region: f.region, provincia: f.provincia, limit: f.limit || 30 });
    const raw = await this._get(`/api/v1/clusters${p}`, { cacheMs: f.cacheMs });
    return { total: raw.total || 0, clusters: raw.clusters || [] };
  }

  /** Reloj de la noticia: quién publicó primero y cuánto tardó cada réplica. */
  async reloj(f = {}) {
    validateVentana(f.ventana);
    const p = qs({ ventana: f.ventana || '24h', limite: f.limite || 20 });
    const raw = await this._get(`/api/v1/reloj${p}`, { cacheMs: f.cacheMs });
    return { ventana: raw.ventana, historias: raw.historias || [] };
  }

  /** Vacíos de cobertura: temas nacionales sin nota local en cada provincia. */
  async gaps(f = {}) {
    validateVentana(f.ventana);
    const p = qs({ ventana: f.ventana || '24h', provincia: f.provincia, limit: f.limit || 30 });
    const raw = await this._get(`/api/v1/gaps${p}`, { cacheMs: f.cacheMs });
    return { ventana: raw.ventana, items_ventana: raw.items_ventana || 0, gaps: raw.gaps || [] };
  }

  /** Solo la fuente que publicó primero en cada cluster. */
  async primicias(f = {}) {
    validateVentana(f.ventana);
    const p = qs({ ventana: f.ventana || '24h', limit: f.limit || 30 });
    const raw = await this._get(`/api/v1/primicias${p}`, { cacheMs: f.cacheMs });
    return { total: raw.total || 0, primicias: (raw.primicias || []).map(normalizeItem) };
  }

  /** Posibles exclusivas: una sola fuente, nadie las replicó. */
  async huerfanas(f = {}) {
    validateVentana(f.ventana);
    const p = qs({ ventana: f.ventana || '24h', provincia: f.provincia, limit: f.limit || 30 });
    const raw = await this._get(`/api/v1/huerfanas${p}`, { cacheMs: f.cacheMs });
    return { total: raw.total || 0, huerfanas: (raw.huerfanas || []).map(normalizeItem) };
  }

  /** Mapa de calor provincial en JSON. */
  async mapa(f = {}) {
    validateVentana(f.ventana);
    const p = qs({ ventana: f.ventana || '6h' });
    const raw = await this._get(`/api/v1/mapa${p}`, { cacheMs: f.cacheMs });
    return { ventana: raw.ventana, total_items: raw.total_items || 0, provincias: raw.provincias || [] };
  }

  /** Catálogo de fuentes del radar. */
  async sources(f = {}) {
    const p = qs({ tipo: f.tipo, provincia: f.provincia, region: f.region, canonico: f.canonico, canal: f.canal });
    const raw = await this._get(`/api/v1/sources${p}`, { cacheMs: f.cacheMs });
    return { total: raw.total || 0, fuentes: raw.fuentes || [] };
  }

  /** Búsqueda en titulo/bajada con diccionario español. */
  async buscar(f = {}) {
    validateVentana(f.ventana);
    validateTema(f.tema);
    if (!f.q) throw new Error('falta el término de búsqueda (q)');
    const p = qs({ q: f.q, ventana: f.ventana || '48h', provincia: f.provincia, tema: f.tema, limite: f.limite || 50 });
    const raw = await this._get(`/api/v1/buscar${p}`, { cacheMs: f.cacheMs });
    return { consulta: raw.consulta, ventana: raw.ventana, total: raw.total || 0, items: raw.items || [] };
  }

  /** Citas textuales recientes. */
  async quotes(f = {}) {
    validateVentana(f.ventana);
    validateTema(f.tema);
    const p = qs({ ventana: f.ventana || '24h', provincia: f.provincia, tema: f.tema, hablante: f.hablante, limite: f.limite || 100 });
    const raw = await this._get(`/api/v1/quotes${p}`, { cacheMs: f.cacheMs });
    return { ventana: raw.ventana, total: raw.total || 0, citas: raw.citas || [] };
  }
}

module.exports = {
  ApiFenix, ApiFenixError, BASE_URL, PLAN_RPM, VENTANAS, TEMAS,
  normalizeItem, cleanHtml, resolveApiKey, createLimiter,
  validateVentana, validateTema,
};
