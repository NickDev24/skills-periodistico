#!/usr/bin/env node
'use strict';
/**
 * CLI de skill-periodistico 1.0.0 (FENIX).
 *
 * Comandos:
 *   install            instala los skills en ./.claude/skills o ./.agents/skills
 *   list               lista skills, tareas y voces
 *   skill <nombre>     muestra un skill
 *   score              score editorial desde flags
 *   prompt <tarea>     arma el prompt de una tarea
 *   radar              escanea el radar de Radar Notiviral
 *   señales            señales del momento (clusters, primicias, huérfanas, gaps, mapa)
 *   gaps               vacíos de cobertura (oportunidades de reportaje)
 *   pipeline           radar → triaje → prompt de una tarea, en un paso
 *   verificar          checklist de verificación de una afirmación
 *   digesto            digesto de radar listo para redactar
 */
const fs = require('fs');
const path = require('path');
const lib = require('../src/index.js');
const { ApiFenix, resolveApiKey } = require('../src/api.js');
const {
  escanearRadar, senalesDelMomento, prepararPieza, digestoRadar,
} = require('../src/pipeline.js');
const {
  clasificarEvidencia, preguntasPrueba, verificarCifra, detectarAlertas, controlFinal,
} = require('../src/verificacion.js');

const [, , cmd, ...rest] = process.argv;

function parseArgs(args) {
  const flags = {};
  const pos = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = args[i + 1];
      if (next === undefined || next.startsWith('--')) flags[key] = true;
      else { flags[key] = next; i++; }
    } else pos.push(a);
  }
  return { flags, pos };
}

function help() {
  console.log(`skill-periodistico 1.0.0 (FENIX): criterio, decisión y redacción periodística para agentes de IA

Fuente de señales: Radar Notiviral (API FENIX) — https://radar-notiviral.online
Autenticación: encabezado X-API-Key (env FENIX_KEY, archivo ~/.fenix-key o --key)

Uso:
  npx skill-periodistico install [--target claude|agents] [--dest <carpeta>] [--force]
  npx skill-periodistico list
  npx skill-periodistico skill <nombre>
  npx skill-periodistico score --proximidad_local 90 --novedad 80 --verificabilidad 100 [--json]
  npx skill-periodistico prompt <tarea> [--medio X] [--region X] [--voz X] [--fuentes X] [--sin-skills] [--json]
  npx skill-periodistico radar [--provincia AR-A] [--ventana 6h] [--tema servicio] [--orden velocidad] [--key K] [--json]
  npx skill-periodistico señales [--provincia AR-A] [--ventana 6h] [--key K] [--json]
  npx skill-periodistico gaps [--provincia AR-A] [--ventana 24h] [--key K] [--json]
  npx skill-periodistico pipeline <tarea> [--provincia AR-A] [--ventana 6h] [--key K] [--json]
  npx skill-periodistico digesto [--provincia AR-A] [--ventana 6h] [--key K] [--json]
  npx skill-periodistico verificar --afirmacion "..." [--material "..."] [--json]

Tareas: ${lib.listTareas().join(', ')}
Voces:  ${lib.listVoces().join(', ')}

Ejemplos:
  npx skill-periodistico install
  npx skill-periodistico radar --provincia AR-A --ventana 6h --orden velocidad
  npx skill-periodistico pipeline placa --provincia AR-A --ventana 6h --medio "Mi Medio"
  npx skill-periodistico gaps --provincia AR-A --ventana 24h`);
}

function install(flags) {
  const target = flags.target || 'claude';
  const defaultDest = target === 'agents' ? '.agents/skills' : '.claude/skills';
  const dest = path.resolve(process.cwd(), typeof flags.dest === 'string' ? flags.dest : defaultDest);
  fs.mkdirSync(dest, { recursive: true });

  const installed = [];
  for (const s of lib.listSkills()) {
    const to = path.join(dest, s.name);
    if (fs.existsSync(to) && !flags.force) {
      console.log(`= ya existe, se omite: ${s.name} (usá --force para sobrescribir)`);
      continue;
    }
    fs.cpSync(path.join(lib.DIRS.skills, s.name), to, { recursive: true });
    installed.push(s.name);
  }

  // Skill generado con las voces editoriales
  const vocesDir = path.join(dest, 'voces-editoriales');
  if (!fs.existsSync(vocesDir) || flags.force) {
    fs.mkdirSync(vocesDir, { recursive: true });
    const cuerpo = lib.listVoces()
      .map((v) => `## ${v}\n${lib.loadVoz(v)}`)
      .join('\n\n');
    fs.writeFileSync(
      path.join(vocesDir, 'SKILL.md'),
      `---\nname: voces-editoriales\ndescription: Voces editoriales (urbano ágil, cercano local, institucional serio, cronista cálido, datos frío, alerta servicio, análisis corto) para elegir el tono de una pieza periodística.\n---\n\n# Voces editoriales\nElegí la voz según la zona y el tema. Aplicala sin convertirla en opinión sobre los hechos.\n\n${cuerpo}\n`
    );
    installed.push('voces-editoriales');
  }

  console.log(`\nInstalados en ${dest}:`);
  installed.forEach((n) => console.log(`  + ${n}`));
  console.log('\nListo. Tu agente ya puede usar estos skills.');
}

function outJson(obj) { console.log(JSON.stringify(obj, null, 2)); }

async function cmdRadar(flags) {
  const api = new ApiFenix({ apiKey: flags.key });
  if (!api.keyConfigured) {
    console.error('Falta la API key de Radar Notiviral. Definí FENIX_KEY, ~/.fenix-key o usá --key.');
    process.exit(1);
  }
  const res = await escanearRadar({
    provincia: flags.provincia, region: flags.region, tema: flags.tema,
    tipo: flags.tipo, ventana: flags.ventana || '6h', orden: flags.orden,
    min_fuentes: flags.min_fuentes, search: flags.search,
    clusters: flags.clusters, huerfanas: flags.huerfanas, primicia: flags.primicia,
    gap: flags.gap, sin_video: flags.sin_video,
  }, api);
  if (flags.json) { outJson(res); return; }
  console.log(`Radar · ${res.total} ítems · ventana ${flags.ventana || '6h'}${flags.provincia ? ' · ' + flags.provincia : ''}\n`);
  for (const c of res.candidatas.slice(0, 15)) {
    const senales = c.senales.length ? ` [${c.senales.join(', ')}]` : '';
    console.log(`${String(c.score).padStart(5)}  ${c.prioridad.padEnd(5)}  ${c.titulo}${senales}`);
    console.log(`        ${c.fuente_origen} · ${c.provincia || '¿?'} · ${c.tema} · ${c.publicado_en || '¿?'}`);
  }
  console.log('\nTip: usá --json para la salida completa, o pipeline <tarea> para redactar.');
}

async function cmdSenales(flags) {
  const api = new ApiFenix({ apiKey: flags.key });
  if (!api.keyConfigured) {
    console.error('Falta la API key de Radar Notiviral. Definí FENIX_KEY, ~/.fenix-key o usá --key.');
    process.exit(1);
  }
  const s = await senalesDelMomento({ provincia: flags.provincia, ventana: flags.ventana || '6h' }, api);
  if (flags.json) { outJson(s); return; }
  console.log(`Señales del momento · ventana ${s.ventana}${s.provincia !== 'todas' ? ' · ' + s.provincia : ''}\n`);
  console.log(`EN EXPANSIÓN (clusters): ${s.expansion.length}`);
  s.expansion.slice(0, 5).forEach((c) => console.log(`  • ${c.titulo} (${c.n_fuentes} fuentes, primicia: ${c.fuente_primicia})`));
  console.log(`\nPRIMICIAS: ${s.primicias.length}`);
  s.primicias.slice(0, 5).forEach((p) => console.log(`  • ${p.titulo} — ${p.fuente_origen}`));
  console.log(`\nHUÉRFANAS (posibles exclusivas): ${s.huerfanas.length}`);
  s.huerfanas.slice(0, 5).forEach((h) => console.log(`  • ${h.titulo} — ${h.fuente_origen}`));
  console.log(`\nGAPS: ${s.gaps.length}`);
  s.gaps.slice(0, 5).forEach((g) => console.log(`  • ${JSON.stringify(g).slice(0, 160)}`));
  console.log(`\nMAPA: ${s.mapa.length} provincias con pulso`);
}

async function cmdGaps(flags) {
  const api = new ApiFenix({ apiKey: flags.key });
  if (!api.keyConfigured) {
    console.error('Falta la API key de Radar Notiviral. Definí FENIX_KEY, ~/.fenix-key o usá --key.');
    process.exit(1);
  }
  const g = await api.gaps({ provincia: flags.provincia, ventana: flags.ventana || '24h', limit: flags.limit || 30 });
  if (flags.json) { outJson(g); return; }
  console.log(`Gaps de cobertura · ventana ${g.ventana} · ${g.items_ventana} ítems en ventana\n`);
  if (!g.gaps.length) {
    console.log('Sin gaps en esta ventana. Probá otra provincia o ventana más amplia.');
    return;
  }
  g.gaps.forEach((gap, i) => {
    console.log(`${i + 1}. ${JSON.stringify(gap).slice(0, 200)}`);
  });
  console.log('\nUsá la tarea gap-alerta para convertir un gap en propuesta de reportaje.');
}

async function cmdPipeline(flags, pos) {
  const tarea = flags._tarea || pos[0];
  if (!tarea) {
    console.error('Falta la tarea. Opciones: ' + lib.listTareas().join(', '));
    process.exit(1);
  }
  const api = new ApiFenix({ apiKey: flags.key });
  if (!api.keyConfigured) {
    console.error('Falta la API key de Radar Notiviral. Definí FENIX_KEY, ~/.fenix-key o usá --key.');
    process.exit(1);
  }
  const escaneo = await escanearRadar({
    provincia: flags.provincia, region: flags.region, tema: flags.tema,
    ventana: flags.ventana || '6h', orden: flags.orden || 'fecha',
    min_fuentes: flags.min_fuentes, clusters: flags.clusters, huerfanas: flags.huerfanas,
  }, api);
  const candidata = escaneo.candidatas[0];
  if (!candidata) {
    console.error('No hay candidatas en el radar con esos filtros.');
    process.exit(1);
  }
  const vars = {};
  if (flags.medio) vars.nombre_medio = flags.medio;
  if (flags.region) vars.region = flags.region;
  if (flags.voz) vars.voz = flags.voz;
  if (flags.fuentes) vars.fuentes = flags.fuentes;
  if (flags.titulo) vars.titulo = flags.titulo;
  if (flags.bajada) vars.bajada = flags.bajada;
  if (flags.cuerpo) vars.cuerpo = flags.cuerpo;
  if (flags.provincia) vars.provincia = flags.provincia;
  if (flags.tema) vars.tema = flags.tema;
  if (flags.ventana) vars.ventana = flags.ventana;
  if (flags.nivel_evidencia) vars.nivel_evidencia = flags.nivel_evidencia;
  const pieza = prepararPieza({ item: candidata, tarea, vars });
  if (flags.json) { outJson(pieza); return; }
  console.log(`Pipeline · tarea: ${tarea} · candidata: ${candidata.titulo}`);
  console.log(`Score: ${pieza.triaje.score} (${pieza.triaje.prioridad}) · Publicable: ${pieza.decision.publicar ? 'sí' : 'no'}`);
  if (pieza.decision.alertas.length) console.log(`Alertas: ${pieza.decision.alertas.join('; ')}`);
  console.log(`Senales: ${pieza.triaje.senales.join(', ') || 'ninguna'}\n`);
  console.log('===== SYSTEM =====\n' + pieza.prompt.system + '\n\n===== USER =====\n' + pieza.prompt.user);
  if (pieza.prompt.missing.length) console.error('\n(variables sin completar: ' + pieza.prompt.missing.join(', ') + ')');
}

async function cmdDigesto(flags) {
  const api = new ApiFenix({ apiKey: flags.key });
  if (!api.keyConfigured) {
    console.error('Falta la API key de Radar Notiviral. Definí FENIX_KEY, ~/.fenix-key o usá --key.');
    process.exit(1);
  }
  const vars = {
    nombre_medio: flags.medio, region: flags.region, voz: flags.voz, fuentes: flags.fuentes,
    provincia: flags.provincia, ventana: flags.ventana || '6h',
  };
  const d = await digestoRadar({ provincia: flags.provincia, ventana: flags.ventana || '6h', vars }, api);
  if (flags.json) { outJson(d); return; }
  console.log('===== SYSTEM =====\n' + d.prompt.system + '\n\n===== USER =====\n' + d.prompt.user);
  if (d.prompt.missing.length) console.error('\n(variables sin completar: ' + d.prompt.missing.join(', ') + ')');
}

function cmdVerificar(flags) {
  if (!flags.afirmacion) {
    console.error('Falta --afirmacion. Ej: verificar --afirmacion "Subió 40%" --material "..."');
    process.exit(1);
  }
  const material = flags.material ? JSON.parse(flags.material) : {};
  const resultado = {
    afirmacion: flags.afirmacion,
    evidencia: clasificarEvidencia(material),
    preguntas: preguntasPrueba(material),
    alertas: detectarAlertas(material),
  };
  if (flags.json) { outJson(resultado); return; }
  console.log(`Afirmación: ${flags.afirmacion}`);
  console.log(`Nivel de evidencia: ${resultado.evidencia.nivel} — ${resultado.evidencia.lenguaje}`);
  console.log(`Requiere atribución: ${resultado.evidencia.requiere_atribucion ? 'sí' : 'no'}`);
  console.log(`Publicable como hecho: ${resultado.evidencia.publicable_como_hecho ? 'sí' : 'no'}`);
  if (resultado.preguntas.faltan.length) console.log(`Faltan respuestas: ${resultado.preguntas.faltan.join(', ')}`);
  if (resultado.alertas.length) console.log(`Alertas: ${resultado.alertas.join('; ')}`);
}

function main() {
  const { flags, pos } = parseArgs(rest);
  switch (cmd) {
    case 'install':
      return install(flags);
    case 'list':
      console.log('Skills:');
      lib.listSkills().forEach((s) => console.log(`  - ${s.name}: ${s.description}`));
      console.log('\nTareas: ' + lib.listTareas().join(', '));
      console.log('Voces:  ' + lib.listVoces().join(', '));
      return;
    case 'skill': {
      if (!pos[0]) { console.error('Falta el nombre del skill.'); process.exit(1); }
      console.log(lib.loadSkill(pos[0]));
      return;
    }
    case 'score': {
      const input = {};
      for (const [key, value] of Object.entries(flags)) {
        if (key === 'json') continue;
        input[key] = value === true ? value : Number(value);
      }
      const out = lib.decidirEditorial(input);
      outJson(out);
      return;
    }
    case 'prompt': {
      if (!pos[0]) { console.error('Falta la tarea. Opciones: ' + lib.listTareas().join(', ')); process.exit(1); }
      const vars = {};
      if (flags.medio) vars.nombre_medio = flags.medio;
      if (flags.region) vars.region = flags.region;
      if (flags.voz) vars.voz = flags.voz;
      if (flags.fuentes) vars.fuentes = flags.fuentes;
      if (flags.titulo) vars.titulo = flags.titulo;
      if (flags.bajada) vars.bajada = flags.bajada;
      if (flags.cuerpo) vars.cuerpo = flags.cuerpo;
      if (flags.fuente) vars.fuente = flags.fuente;
      if (flags.url) vars.url = flags.url;
      if (flags.senales) vars.senales = flags.senales;
      if (flags.nivel_evidencia) vars.nivel_evidencia = flags.nivel_evidencia;
      const out = lib.buildPrompt({ tarea: pos[0], vars, sinSkills: !!flags['sin-skills'] });
      if (flags.json) { outJson(out); return; }
      console.log('===== SYSTEM =====\n' + out.system + '\n\n===== USER =====\n' + out.user);
      if (out.missing.length) console.error('\n(variables sin completar: ' + out.missing.join(', ') + ')');
      return;
    }
    case 'radar':
      return cmdRadar(flags);
    case 'señales':
      return cmdSenales(flags);
    case 'gaps':
      return cmdGaps(flags);
    case 'pipeline':
      return cmdPipeline(flags, pos);
    case 'digesto':
      return cmdDigesto(flags);
    case 'verificar':
      return cmdVerificar(flags);
    default:
      return help();
  }
}

try { main(); } catch (e) { console.error('Error: ' + e.message); process.exit(1); }
