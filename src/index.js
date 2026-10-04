'use strict';
/**
 * Motor editorial de skill-periodistico 1.0.0 (FENIX).
 *
 * Fusiona el criterio de ambas versiones previas y agrega:
 *  - Score editorial ponderado (ordena, nunca habilita publicar)
 *  - Decisión editorial con alertas y abstención
 *  - Detector emocional con riesgo de manipulación
 *  - Anti-saturación (duplicado / actualización / profundización / nueva / exclusiva)
 *  - Psicología de atención (variables y orden de intensidad)
 *  - Triaje de ítems del radar (normalizados por src/api.js)
 *  - Trazabilidad: cada decisión lleva sus razones
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIRS = {
  skills: path.join(ROOT, 'skills'),
  voces: path.join(ROOT, 'voces'),
  plantillas: path.join(ROOT, 'plantillas'),
  evals: path.join(ROOT, 'evals'),
};

const DEFAULTS = {
  nombre_medio: 'el medio',
  region: 'Salta Capital, Argentina',
  fuentes: '(sin fuentes definidas: atribuí solo lo que figura en el material)',
  voz: 'urbano-agil',
  extension: '600 a 900 palabras',
  bloques: '4 a 6',
};

/* ------------------------------------------------------------------ */
/* Utilidades de archivos                                              */
/* ------------------------------------------------------------------ */

function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: text.trim() };
  const meta = {};
  m[1].split(/\r?\n/).forEach((line) => {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  });
  return { meta, body: m[2].trim() };
}

function read(file) { return fs.readFileSync(file, 'utf8'); }

function listSkills() {
  return fs
    .readdirSync(DIRS.skills, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(DIRS.skills, d.name, 'SKILL.md')))
    .map((d) => {
      const { meta } = parseFrontmatter(read(path.join(DIRS.skills, d.name, 'SKILL.md')));
      return { name: meta.name || d.name, description: meta.description || '' };
    });
}

function loadSkill(name) {
  const file = path.join(DIRS.skills, name, 'SKILL.md');
  if (!fs.existsSync(file)) throw new Error(`Skill inexistente: ${name}`);
  return parseFrontmatter(read(file)).body;
}

function listVoces() {
  return fs.readdirSync(DIRS.voces).filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, ''));
}

function loadVoz(name) {
  const file = path.join(DIRS.voces, `${name}.md`);
  if (!fs.existsSync(file)) return null;
  return parseFrontmatter(read(file)).body;
}

function listTareas() {
  return fs.readdirSync(DIRS.plantillas).filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, ''));
}

function loadPlantilla(tarea) {
  const file = path.join(DIRS.plantillas, `${tarea}.md`);
  if (!fs.existsSync(file)) {
    throw new Error(`Tarea inexistente: ${tarea}. Disponibles: ${listTareas().join(', ')}`);
  }
  const { meta, body } = parseFrontmatter(read(file));
  const parts = body.split(/^## USER\s*$/m);
  const system = parts[0].replace(/^## SYSTEM\s*$/m, '').trim();
  const user = (parts[1] || '').trim();
  const skills = (meta.skills || '').split(',').map((s) => s.trim()).filter(Boolean);
  return { tarea, skills, system, user };
}

// Reemplaza solo {{clave}} presentes en vars. Devuelve texto y las claves sin resolver.
function render(text, vars) {
  const missing = new Set();
  const out = text.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (all, key) => {
    if (Object.prototype.hasOwnProperty.call(vars, key) && vars[key] !== undefined) return String(vars[key]);
    missing.add(key);
    return all;
  });
  return { text: out, missing: [...missing] };
}

/**
 * Arma el prompt completo para una tarea.
 * @param {object} o
 * @param {string} o.tarea reel | placa | articulo | opinion | meme | curador | formato-post | radar-digest | gap-alerta | cluster-seguimiento | primicia-nota | verificacion-nota | servicio-util | hilo-x | newsletter-bloque
 * @param {object} [o.vars] variables de plantilla
 * @param {string[]} [o.skills] sobrescribe los skills incluidos
 * @param {boolean} [o.sinSkills] no antepone skills (solo la plantilla)
 * @returns {{system:string,user:string,missing:string[]}}
 */
function buildPrompt({ tarea, vars = {}, skills, sinSkills = false }) {
  const p = loadPlantilla(tarea);
  const v = { ...DEFAULTS, ...vars };
  const vozTexto = loadVoz(v.voz);
  if (vozTexto) v.voz = vozTexto;

  const skillNames = skills || p.skills;
  const base = sinSkills ? '' : skillNames.map((n) => loadSkill(n)).join('\n\n---\n\n') + '\n\n---\n\n';

  const sys = render(p.system, v);
  const usr = render(p.user, v);
  return {
    system: base + sys.text,
    user: usr.text,
    missing: [...new Set([...sys.missing, ...usr.missing])],
  };
}

function loadEvals() {
  return JSON.parse(read(path.join(DIRS.evals, 'casos.json')));
}

/* ------------------------------------------------------------------ */
/* Score editorial                                                   */
/* ------------------------------------------------------------------ */

const SCORE_WEIGHTS = Object.freeze({
  proximidad_local: 0.15,
  actualidad: 0.12,
  novedad: 0.12,
  consecuencias: 0.14,
  utilidad: 0.10,
  interes_humano: 0.08,
  interes_publico: 0.08,
  calidad_fuente: 0.08,
  verificabilidad: 0.08,
  exclusividad: 0.05,
});

function clamp(n, min = 0, max = 100) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
}

function scoreEditorial(input = {}) {
  const factores = {};
  let interes = 0;
  for (const [key, weight] of Object.entries(SCORE_WEIGHTS)) {
    factores[key] = clamp(input[key]);
    interes += factores[key] * weight;
  }
  const saturacion = clamp(input.saturacion);
  const riesgo = clamp(input.riesgo);
  const score = clamp(interes - (saturacion * 0.05) - (riesgo * 0.05));
  const prioridad = score >= 75 ? 'alta' : score >= 50 ? 'media' : 'baja';
  return {
    score: Math.round(score * 100) / 100,
    prioridad,
    factores,
    penalizaciones: { saturacion, riesgo },
    publicable: input.publicable !== false && clamp(input.verificabilidad) >= 40 && riesgo < 90,
  };
}

function decidirEditorial(input = {}) {
  const score = scoreEditorial(input);
  const alertas = [];
  const evidencia = String(input.nivel_evidencia || '').toUpperCase();
  if (['N4', 'N5', 'N6'].includes(evidencia)) alertas.push('evidencia que exige atribución o tratamiento especial');
  if (score.penalizaciones.saturacion >= 70) alertas.push('tema saturado');
  if (score.penalizaciones.riesgo >= 70) alertas.push('riesgo editorial alto');
  if (score.factores.verificabilidad < 50) alertas.push('verificabilidad baja');
  if (input.abstener === true) alertas.push('abstención solicitada por criterio editorial');

  let publicar = score.publicable && input.abstener !== true;
  let motivo = publicar ? 'candidata editorialmente viable' : 'no publicar hasta resolver las alertas';

  return {
    publicar,
    motivo,
    score: score.score,
    prioridad: score.prioridad,
    factores: score.factores,
    alertas,
  };
}

/* ------------------------------------------------------------------ */
/* Detector emocional                                                */
/* ------------------------------------------------------------------ */

const EMOCIONES = [
  'sorpresa', 'curiosidad', 'preocupacion', 'indignacion', 'alegria',
  'esperanza', 'tristeza', 'miedo', 'alivio', 'orgullo_local',
  'identificacion', 'humor', 'urgencia', 'utilidad',
];

function detectarEmocional(input = {}) {
  const dominante = String(input.dominante || '').toLowerCase();
  const secundarias = (Array.isArray(input.secundarias) ? input.secundarias : []).map((s) => String(s).toLowerCase());
  const intensidad = clamp(input.intensidad);
  const riesgo_manipulacion = clamp(input.riesgo_manipulacion);
  const alertas = [];
  if (!EMOCIONES.includes(dominante)) alertas.push('emocion dominante no reconocida');
  if (intensidad >= 80 && !['urgencia', 'utilidad', 'preocupacion'].includes(dominante)) {
    alertas.push('intensidad alta sin justificacion de servicio: revisar dramatizacion');
  }
  if (riesgo_manipulacion >= 70) alertas.push('alto riesgo de manipulacion emocional');
  if (dominante === 'miedo' && intensidad > 60) alertas.push('miedo como recurso: verificar que la fuente respalde el riesgo');
  if (dominante === 'indignacion' && intensidad > 60) alertas.push('indignacion editorial: separar del hecho');
  return {
    dominante: dominante || null,
    secundarias: secundarias.filter((s) => EMOCIONES.includes(s)),
    intensidad,
    riesgo_manipulacion,
    uso_editorial: input.uso_editorial || 'angulo',
    alertas,
  };
}

/* ------------------------------------------------------------------ */
/* Anti-saturación                                                   */
/* ------------------------------------------------------------------ */

function antiSaturation(input = {}) {
  const similitud = clamp(input.similitud);
  const novedad_real = clamp(input.novedad_real);
  let estado;
  if (similitud >= 90 && novedad_real < 20) estado = 'duplicado';
  else if (similitud >= 70 && novedad_real >= 30) estado = 'actualizacion';
  else if (similitud >= 50 && novedad_real >= 40) estado = 'profundizacion';
  else if (similitud < 40) estado = 'nueva_noticia';
  else estado = input.exclusiva ? 'exclusiva' : 'nueva_noticia';
  const publicar = estado !== 'duplicado';
  return {
    estado,
    similitud,
    novedad_real,
    que_cambio: input.que_cambio || '',
    publicar,
    recomendacion: estado === 'duplicado'
      ? 'no publicar: no aporta informacion nueva'
      : estado === 'actualizacion'
        ? 'publicar titulando la novedad, no repitiendo el acontecimiento'
        : estado === 'profundizacion'
          ? 'publicar con enfoque de contexto y evidencia nueva'
          : 'publicar como noticia nueva',
  };
}

/* ------------------------------------------------------------------ */
/* Psicología de atención                                            */
/* ------------------------------------------------------------------ */

function psicologiaAtencion(input = {}) {
  const vars = {};
  for (const k of ['relevancia_personal', 'proximidad', 'novedad', 'consecuencia', 'utilidad', 'interes_humano', 'curiosidad_legitima', 'tension_factual']) {
    vars[k] = clamp(input[k]);
  }
  const total = Math.round(Object.values(vars).reduce((a, b) => a + b, 0) / 8);
  const orden = [
    'consecuencia para la audiencia',
    'dato nuevo',
    'lugar o persona concreta',
    'explicacion de por que importa',
    'contexto minimo',
  ];
  return {
    variables: vars,
    potencial_atencion: total,
    orden_recomendado: orden,
    reduce_atencion: [
      'introducciones institucionales largas',
      'antecedentes que no cambian la comprension',
      'repetir el titular',
      'adjetivos sin informacion',
      'misterio artificial',
      'indignacion editorial disfrazada de noticia',
      'exceso de contexto antes del hecho principal',
    ],
  };
}

/* ------------------------------------------------------------------ */
/* Triaje de ítems del radar                                         */
/* ------------------------------------------------------------------ */

/**
 * Convierte un ítem normalizado de Radar Notiviral en una candidata
 * editorial con factores de score derivados de sus señales reales.
 * Los factores son una estimación de partida: el criterio humano o
 * del modelo debe ajustarlos con el material completo.
 */
function triarItem(item = {}) {
  const nFuentes = Number(item.n_fuentes) || 1;
  const esPrimicia = !!item.es_primicia;
  const esHuerfana = !!item.es_huerfana;
  const esGap = !!item.es_gap;
  const velocidad = Number(item.velocidad_min) || 0;

  // Actualidad: 0-100 según antigüedad (ventana de 48h)
  let actualidad = 50;
  if (item.publicado_en) {
    const horas = (Date.now() - new Date(item.publicado_en).getTime()) / 3600000;
    actualidad = clamp(100 - (horas / 48) * 100);
  }

  const factores = {
    proximidad_local: item.provincia ? 70 : 40, // ajustar con región del medio
    actualidad: Math.round(actualidad),
    novedad: esHuerfana ? 90 : esPrimicia ? 80 : nFuentes >= 3 ? 60 : 50,
    consecuencias: 50, // requiere lectura del material
    utilidad: item.tema === 'servicio' ? 85 : 50,
    interes_humano: 50,
    interes_publico: ['seguridad', 'politica', 'economia'].includes(item.tema) ? 70 : 50,
    calidad_fuente: item.tipo === 'editorial' ? 70 : 55,
    verificabilidad: esPrimicia ? 75 : 60,
    exclusividad: esHuerfana ? 95 : esPrimicia ? 85 : 30,
    saturacion: nFuentes >= 6 ? 70 : nFuentes >= 3 ? 40 : 10,
    riesgo: item.tema === 'seguridad' ? 45 : 20,
  };

  const score = scoreEditorial(factores);
  const senales = [];
  if (esPrimicia) senales.push('primicia');
  if (esHuerfana) senales.push('huerfana (posible exclusiva)');
  if (esGap) senales.push('gap de cobertura');
  if (nFuentes >= 2) senales.push(`en expansion (${nFuentes} fuentes)`);
  if (velocidad > 0) senales.push(`velocidad ${Math.round(velocidad)} min`);
  if (item.ia_match) senales.push('posible contenido IA: verificar origen');

  return {
    id: item.id,
    titulo: item.titulo,
    bajada: item.bajada || '',
    contenido: item.contenido || '',
    fuente_origen: item.fuente_origen,
    provincia: item.provincia,
    tema: item.tema,
    publicado_en: item.publicado_en,
    url: item.url,
    senales,
    n_fuentes: nFuentes,
    score: score.score,
    prioridad: score.prioridad,
    publicable: score.publicable,
    factores,
  };
}

/** Ordena candidatas por score y aplica filtros duros de publicabilidad. */
function triarLista(items = []) {
  return items
    .map(triarItem)
    .sort((a, b) => b.score - a.score);
}

module.exports = {
  DIRS, DEFAULTS, SCORE_WEIGHTS, EMOCIONES,
  parseFrontmatter,
  listSkills, loadSkill, listVoces, loadVoz,
  listTareas, loadPlantilla, render, buildPrompt, loadEvals,
  clamp, scoreEditorial, decidirEditorial,
  detectarEmocional, antiSaturation, psicologiaAtencion,
  triarItem, triarLista,
};
