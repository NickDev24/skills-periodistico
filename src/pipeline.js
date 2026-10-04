'use strict';
/**
 * Pipeline de redacción: radar → triaje → score → formato → prompt.
 *
 * Conecta la API de Radar Notiviral con el motor editorial y las
 * plantillas de salida, para pasar de "qué está pasando" a
 * "pieza lista para el modelo" en un solo paso.
 */
const { ApiFenix, normalizeItem } = require('./api.js');
const {
  triarItem, triarLista, scoreEditorial, decidirEditorial,
  antiSaturation, detectarEmocional, buildPrompt, DEFAULTS,
} = require('./index.js');

/**
 * Escanea el radar y devuelve candidatas triadas.
 * @param {object} opts filtros de items() de ApiFenix
 * @param {object} api instancia ApiFenix (opcional; se crea si no se pasa)
 */
async function escanearRadar(opts = {}, api) {
  const client = api || new ApiFenix({});
  const res = await client.items({ page_size: 50, ...opts });
  const candidatas = triarLista(res.data);
  return {
    total: res.pagination ? res.pagination.total : candidatas.length,
    candidatas,
    filtros: res.filters,
  };
}

/**
 * Señales del momento: clusters en expansión, primicias,
 * huérfanas y gaps, en una sola lectura.
 */
async function senalesDelMomento({ provincia, ventana = '6h', api } = {}) {
  const client = api || new ApiFenix({});
  const [clusters, primicias, huerfanas, gaps, mapa] = await Promise.all([
    client.clusters({ provincia, ventana, limit: 10 }),
    client.primicias({ ventana, limit: 10 }),
    client.huerfanas({ provincia, ventana, limit: 10 }),
    client.gaps({ provincia, ventana, limit: 10 }),
    client.mapa({ ventana }),
  ]);
  return {
    provincia: provincia || 'todas',
    ventana,
    expansion: clusters.clusters,
    primicias: primicias.primicias,
    huerfanas: huerfanas.huerfanas,
    gaps: gaps.gaps,
    mapa: mapa.provincias,
  };
}

// Defaults de plantilla para que no queden {{...}} sin resolver
// cuando se arma un prompt desde el radar.
const DEFAULTS_PLANTILLA = {
  arquetipo: 'informativo',
  tono: 'neutro',
  estructura: 'estandar',
  formato: '',
  extension: '600 a 900 palabras',
  bloques: '4 a 6',
  temas_boost: 'servicios, tránsito, seguridad, economía local',
  nombre_formato: 'web',
  zona: 'Salta Capital',
  nivel_evidencia: 'N3',
  similitud: 0,
  novedad_real: 50,
  que_cambio: '',
  dominante: 'utilidad',
  secundarias: [],
  intensidad: 50,
  riesgo_manipulacion: 10,
  uso_editorial: 'angulo',
  afirmacion: '',
  material: '',
  fuente_promueve: '',
  que_cambia: '',
  vigencia: '',
  fuente_oficial: '',
  contexto_nacional: '',
  cluster_id: '',
  fuente_primicia: '',
  cadena: [],
  expansion: [],
  primicias: [],
  huerfanas: [],
  gaps: [],
  mapa: [],
  candidatas: '',
  score: 50,
  territorio: '',
  fecha: '',
  n_fuentes: 1,
  senales: 'ninguna',
};

/**
 * Prepara una candidata para redacción: score + decisión +
 * anti-saturación + detector emocional + prompt de la tarea.
 */
function prepararPieza({ item, tarea, vars = {}, skills, sinSkills = false } = {}) {
  const normalizado = item.id ? item : normalizeItem(item);
  const triaje = triarItem(normalizado);
  const decision = decidirEditorial({
    ...triaje.factores,
    nivel_evidencia: vars.nivel_evidencia,
    abstener: vars.abstener,
  });
  const saturacion = antiSaturation({
    similitud: vars.similitud,
    novedad_real: vars.novedad_real,
    que_cambio: vars.que_cambio,
    exclusiva: normalizado.es_huerfana,
  });
  const emocion = detectarEmocional({
    dominante: vars.dominante,
    secundarias: vars.secundarias,
    intensidad: vars.intensidad,
    riesgo_manipulacion: vars.riesgo_manipulacion,
  });

  const promptVars = {
    ...DEFAULTS_PLANTILLA,
    ...DEFAULTS,
    ...vars,
    titulo: vars.titulo || normalizado.titulo,
    bajada: vars.bajada || normalizado.bajada,
    cuerpo: vars.cuerpo || normalizado.contenido,
    fuente: vars.fuente || normalizado.fuente_origen,
    url: vars.url || normalizado.url,
    territorio: vars.territorio || normalizado.provincia,
    provincia: vars.provincia || normalizado.provincia,
    tema: vars.tema || normalizado.tema,
    fecha: vars.fecha || normalizado.publicado_en,
    n_fuentes: vars.n_fuentes || normalizado.n_fuentes,
    senales: vars.senales || (triaje.senales.join(', ') || 'ninguna'),
    score: vars.score || triaje.score,
  };

  const prompt = buildPrompt({ tarea, vars: promptVars, skills, sinSkills });

  return {
    triaje,
    decision,
    saturacion,
    emocion,
    prompt,
  };
}

/**
 * Digesto de radar: resumen editorial de las señales del momento,
 * listo para que el modelo redacte un radar-digest.
 */
async function digestoRadar({ provincia, ventana = '6h', vars = {}, api } = {}) {
  const senales = await senalesDelMomento({ provincia, ventana, api });
  const promptVars = {
    ...DEFAULTS,
    ...vars,
    provincia: provincia || 'todas las provincias',
    ventana,
    expansion: JSON.stringify(senales.expansion, null, 2),
    primicias: JSON.stringify(senales.primicias, null, 2),
    huerfanas: JSON.stringify(senales.huerfanas, null, 2),
    gaps: JSON.stringify(senales.gaps, null, 2),
    mapa: JSON.stringify(senales.mapa, null, 2),
  };
  const prompt = buildPrompt({ tarea: 'radar-digest', vars: promptVars });
  return { senales, prompt };
}

module.exports = {
  escanearRadar, senalesDelMomento, prepararPieza, digestoRadar,
};
