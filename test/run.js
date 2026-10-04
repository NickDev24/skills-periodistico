'use strict';
const assert = require('assert');
const lib = require('../src/index.js');
const { ApiFenix, normalizeItem, cleanHtml, validateVentana, validateTema } = require('../src/api.js');
const { escanearRadar, senalesDelMomento, prepararPieza, digestoRadar } = require('../src/pipeline.js');
const {
  clasificarEvidencia, preguntasPrueba, verificarCifra, detectarAlertas, controlFinal,
} = require('../src/verificacion.js');

let ok = 0;
function t(name, fn) {
  try { fn(); ok++; console.log('  ok  ' + name); }
  catch (e) { console.error('  FAIL ' + name + ': ' + e.message); process.exitCode = 1; }
}

console.log('Skills');
for (const s of lib.listSkills()) {
  t(`skill ${s.name} tiene name y description`, () => {
    assert(s.name && s.description.length > 20);
    assert(lib.loadSkill(s.name).length > 200);
  });
}
t('existen los skills esperados (19)', () => {
  const names = lib.listSkills().map((s) => s.name).sort();
  [
    'periodista-criterio', 'titulares-impacto', 'redaccion-narrativa', 'narrativa-video',
    'audiencia-argentina', 'contexto-salta', 'formatos-salida', 'psicologia-atencion',
    'score-editorial', 'detector-emocional', 'anti-saturacion', 'aprendizaje-audiencia',
    'radar-notiviral', 'verificacion-fuentes', 'etica-legal', 'datos-y-cifras',
    'multicanal', 'agenda-propria', 'cobertura-crisis', 'seo-noticias',
  ].forEach((n) => assert(names.includes(n), 'falta ' + n));
});

console.log('Voces');
lib.listVoces().forEach((v) => t(`voz ${v}`, () => assert(lib.loadVoz(v).includes('RASGOS'))));
t('existen 7 voces', () => assert(lib.listVoces().length === 7));

console.log('Plantillas');
const full = {
  nombre_medio: 'Medio Test', region: 'Salta Capital', voz: 'urbano-agil', fuentes: 'Fuente A',
  arquetipo: 'a', tono: 't', estructura: 'e', titulo: 'T', bajada: 'B', cuerpo: 'C', fuente: 'F',
  formato: '', territorio: 'Salta', score: '80', candidatas: '1) x', temas_boost: 'tránsito',
  nombre_formato: 'n', tema: 't', zona: 'z', url: 'u',
  senales: 'ninguna', provincia: 'AR-A', ventana: '6h', expansion: '[]', primicias: '[]',
  huerfanas: '[]', gaps: '[]', mapa: '[]', cluster_id: 'c1', n_fuentes: '2',
  fuente_primicia: 'Medio X', cadena: '[]', contexto_nacional: 'ctx', afirmacion: 'af',
  material: '{}', fuente_promueve: 'fp', que_cambia: 'qc', vigencia: 'v', fuente_oficial: 'fo',
  nivel_evidencia: 'N2', similitud: '10', novedad_real: '80', que_cambio: 'cambio',
  dominante: 'utilidad', secundarias: '[]', intensidad: '50', riesgo_manipulacion: '10',
};
for (const tarea of lib.listTareas()) {
  t(`plantilla ${tarea} se arma sin variables sin resolver`, () => {
    const out = lib.buildPrompt({ tarea, vars: full });
    assert.deepStrictEqual(out.missing, []);
    assert(out.system.includes('Criterio periodístico') || out.system.length > 200, 'falta el núcleo de criterio');
    assert(out.user.length > 20);
    assert(!/\{\{/.test(out.system + out.user), 'quedaron llaves {{ }}');
  });
}
t('el voseo y la voz se inyectan', () => {
  const out = lib.buildPrompt({ tarea: 'reel', vars: full });
  assert(out.system.includes('ágil, directo'));
});
t('todas las tareas esperadas (15)', () => {
  const tareas = lib.listTareas().sort();
  ['reel', 'placa', 'articulo', 'opinion', 'meme', 'curador', 'formato-post',
    'radar-digest', 'gap-alerta', 'cluster-seguimiento', 'primicia-nota',
    'verificacion-nota', 'servicio-util', 'hilo-x', 'newsletter-bloque']
    .forEach((n) => assert(tareas.includes(n), 'falta tarea ' + n));
});

console.log('Motor editorial');
t('score editorial devuelve score, prioridad y publicable', () => {
  const score = lib.scoreEditorial({ proximidad_local: 100, actualidad: 90, novedad: 80, consecuencias: 80, utilidad: 70, interes_humano: 60, interes_publico: 80, calidad_fuente: 100, verificabilidad: 100, exclusividad: 70, saturacion: 10, riesgo: 0 });
  assert(score.score > 70);
  assert(score.publicable === true);
  assert(['alta', 'media', 'baja'].includes(score.prioridad));
});
t('decisión editorial con alertas de evidencia', () => {
  const decision = lib.decidirEditorial({ nivel_evidencia: 'N4', verificabilidad: 70, riesgo: 10 });
  assert(decision.publicar === true);
  assert(decision.alertas.includes('evidencia que exige atribución o tratamiento especial'));
});
t('abstención por verificabilidad baja', () => {
  const decision = lib.decidirEditorial({ verificabilidad: 20, riesgo: 95 });
  assert(decision.publicar === false);
});
t('detector emocional detecta riesgo de manipulación', () => {
  const e = lib.detectarEmocional({ dominante: 'miedo', intensidad: 80, riesgo_manipulacion: 80 });
  assert(e.alertas.length >= 2);
});
t('anti-saturación clasifica duplicado', () => {
  const s = lib.antiSaturation({ similitud: 95, novedad_real: 10 });
  assert(s.estado === 'duplicado');
  assert(s.publicar === false);
});
t('psicología de atención devuelve orden recomendado', () => {
  const p = lib.psicologiaAtencion({ relevancia_personal: 80, proximidad: 90, novedad: 70, consecuencia: 85, utilidad: 90, interes_humano: 60, curiosidad_legitima: 75, tension_factual: 80 });
  assert(p.potencial_atencion > 0);
  assert(p.orden_recomendado.length === 5);
});

console.log('Verificación');
t('clasifica evidencia N1 por documento', () => {
  const e = clasificarEvidencia({ prueba: 'documento' });
  assert(e.nivel === 'N1');
  assert(e.publicable_como_hecho === true);
});
t('clasifica evidencia N4 por declaración', () => {
  const e = clasificarEvidencia({ quien_dice: 'un vecino' });
  assert(e.nivel === 'N4');
  assert(e.requiere_atribucion === true);
});
t('preguntas de prueba detectan faltantes', () => {
  const p = preguntasPrueba({ quien_lo_dice: 'X' });
  assert(p.faltan.length >= 4);
});
t('verificar cifra exige fuente, período y denominador', () => {
  const c = verificarCifra({ valor: '40%' });
  assert(c.verificada === false);
  assert(c.alertas.length >= 3);
});
t('detectar alertas de material riesgoso', () => {
  const a = detectarAlertas({ fuente_anonima: true, imagen_ia: true, menores: true });
  assert(a.length === 3);
});
t('control final aprueba pieza limpia', () => {
  const c = controlFinal({});
  assert(c.aprobado === true);
});
t('control final rechaza pieza con invención', () => {
  const c = controlFinal({ invento_datos: true });
  assert(c.aprobado === false);
});

console.log('API Radar Notiviral');
t('normaliza ítem y limpia HTML', () => {
  const it = normalizeItem({
    id: 'x', titulo: 'T', bajada: '<a href="u">T</a>&nbsp;&nbsp;<font color="#6f6f6f">Medio</font>',
    contenido_texto: '<p>Hola</p><p>Mundo</p>', fuente_origen: 'Medio', provincia: 'AR-A',
    tema: 'servicio', n_fuentes: 2, es_primicia: true, es_huerfana: false, velocidad_min: 5,
  });
  assert(it.bajada === 'T Medio');
  assert(it.contenido === 'Hola\n\nMundo');
  assert(it.es_primicia === true);
  assert(it.n_fuentes === 2);
});
t('cleanHtml maneja entidades y etiquetas', () => {
  assert(cleanHtml('<b>A &amp; B</b>') === 'A & B');
});
t('ApiFenix valida ventana y tema', () => {
  assert.throws(() => validateVentana('99h'), /ventana inválida/);
  assert.throws(() => validateTema('invalido'), /tema inválido/);
  assert.strictEqual(validateVentana('6h'), '6h');
  assert.strictEqual(validateTema('servicio'), 'servicio');
});
t('ApiFenix resuelve key de env o archivo', () => {
  process.env.FENIX_KEY = 'k1';
  const api = new ApiFenix({});
  assert(api.keyConfigured === true);
  delete process.env.FENIX_KEY;
});

console.log('Pipeline');
t('triarItem convierte ítem en candidata con señales', () => {
  const c = lib.triarItem({
    id: 'x', titulo: 'T', fuente_origen: 'Medio', provincia: 'AR-A', tema: 'servicio',
    publicado_en: new Date().toISOString(), n_fuentes: 1, es_huerfana: true, es_primicia: false,
  });
  assert(c.senales.includes('huerfana (posible exclusiva)'));
  assert(c.score >= 0 && c.score <= 100);
});
t('prepararPieza arma prompt con triaje y decisión', () => {
  const pieza = prepararPieza({
    item: { id: 'x', titulo: 'T', bajada: 'B', contenido: 'C', fuente_origen: 'Medio', provincia: 'AR-A', tema: 'servicio', publicado_en: new Date().toISOString(), n_fuentes: 1, es_huerfana: true },
    tarea: 'placa',
    vars: { nombre_medio: 'Medio Test', region: 'Salta Capital', voz: 'urbano-agil', fuentes: 'Fuente A' },
  });
  assert(pieza.triaje.titulo === 'T');
  assert(pieza.decision.publicar !== undefined);
  assert(pieza.prompt.system.length > 200);
  assert(!/\{\{/.test(pieza.prompt.system + pieza.prompt.user));
});
t('triarLista ordena por score', () => {
  const lista = lib.triarLista([
    { id: 'a', titulo: 'A', provincia: 'AR-A', tema: 'servicio', publicado_en: new Date().toISOString(), n_fuentes: 1, es_huerfana: true },
    { id: 'b', titulo: 'B', provincia: 'AR-A', tema: 'general', publicado_en: '2020-01-01T00:00:00Z', n_fuentes: 1 },
  ]);
  assert(lista[0].score >= lista[1].score);
});

console.log('Evals');
t('evals tienen estructura válida', () => {
  const e = lib.loadEvals();
  assert(e.casos.length >= 15);
  e.casos.forEach((c) => {
    assert(c.id && c.tarea && c.entrada && c.debe.length && c.no_debe.length, 'caso incompleto: ' + c.id);
    assert(lib.listTareas().includes(c.tarea), 'tarea inválida en ' + c.id);
  });
});

console.log(`\n${ok} pruebas ok`);
