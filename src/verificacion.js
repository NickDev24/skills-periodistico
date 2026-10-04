'use strict';
/**
 * Verificación: checklist de pruebas por tipo de material,
 * detección de señales de alerta y control de calidad antes
 * de publicar. Complementa el criterio del periodista con
 * reglas ejecutables.
 */

const NIVELES_EV = ['N1', 'N2', 'N3', 'N4', 'N5', 'N6'];

/**
 * Clasifica una afirmación en la escala de evidencia N1-N6.
 * @param {object} a afirmación con {quien_dice, como_sabe, prueba, confirma_independiente}
 */
function clasificarEvidencia(a = {}) {
  const tieneDocumento = a.prueba === 'documento' || a.prueba === 'registro' || a.prueba === 'observacion_directa';
  const dosFuentes = a.confirma_independiente === true;
  const fuenteOficial = a.como_sabe === 'organismo_oficial' || a.como_sabe === 'medio_serio';
  const esDeclaracion = a.quien_dice && !tieneDocumento && !dosFuentes;

  let nivel;
  if (tieneDocumento) nivel = 'N1';
  else if (dosFuentes) nivel = 'N2';
  else if (fuenteOficial) nivel = 'N3';
  else if (esDeclaracion) nivel = 'N4';
  else nivel = 'N5';

  return {
    nivel,
    lenguaje: lenguajeParaNivel(nivel),
    requiere_atribucion: ['N3', 'N4', 'N5'].includes(nivel),
    publicable_como_hecho: ['N1', 'N2'].includes(nivel),
  };
}

function lenguajeParaNivel(nivel) {
  const map = {
    N1: 'Afirmación directa ("se aprobó", "ocurrió")',
    N2: 'Afirmación directa, con las fuentes citadas',
    N3: '"Según [fuente]…", aclarar que es fuente única',
    N4: '"Dijo / afirmó / denunció / informó [quién]"',
    N5: '"Circula una versión…", "sin confirmar"; nunca como hecho',
    N6: 'Marcada como opinión, separada de los hechos',
  };
  return map[nivel] || map.N5;
}

/**
 * Las 6 preguntas de prueba. Devuelve qué falta.
 */
function preguntasPrueba(a = {}) {
  const respuestas = {
    quien_lo_dice: a.quien_lo_dice || null,
    como_lo_sabe: a.como_lo_sabe || null,
    que_prueba_hay: a.que_prueba_hay || null,
    quien_mas_confirma: a.quien_mas_confirma || null,
    que_falta_saber: a.que_falta_saber || null,
    que_cambia_para_la_region: a.que_cambia_para_la_region || null,
  };
  const faltan = Object.entries(respuestas)
    .filter(([, v]) => v === null || v === '' || v === undefined)
    .map(([k]) => k);
  return { respuestas, faltan, lista: Object.keys(respuestas) };
}

/**
 * Verifica una cifra: exige fuente, período y denominador.
 */
function verificarCifra(c = {}) {
  const alertas = [];
  if (!c.valor && c.valor !== 0) alertas.push('falta el valor de la cifra');
  if (!c.fuente) alertas.push('falta la fuente de la cifra');
  if (!c.periodo) alertas.push('falta el período de la cifra');
  if (c.denominador === undefined || c.denominador === null) alertas.push('falta el denominador (base de cálculo)');
  if (typeof c.valor === 'string' && !/^[\d.,%\s]+$/.test(c.valor)) alertas.push('formato de valor no numérico');
  return {
    valor: c.valor,
    fuente: c.fuente || null,
    periodo: c.periodo || null,
    denominador: c.denominador === undefined ? null : c.denominador,
    verificada: alertas.length === 0,
    alertas,
  };
}

/**
 * Señales de alerta en un material (detección de riesgo).
 */
function detectarAlertas(material = {}) {
  const alertas = [];
  if (material.fuente_anonima) alertas.push('fuente anónima: verificar antes de publicar');
  if (material.red_social) alertas.push('red social: indicio, no prueba');
  if (material.captura_pantalla) alertas.push('captura de pantalla: verificar autenticidad');
  if (material.audio_whatsapp) alertas.push('audio de WhatsApp: indicio, no prueba');
  if (material.imagen_ia) alertas.push('imagen generada por IA: nunca es evidencia');
  if (material.recreacion) alertas.push('recreación o ilustración: debe leerse como tal');
  if (material.fuente_interesada) alertas.push('fuente interesada: aclarar el interés');
  if (material.fecha_incierta) alertas.push('fecha incierta: distinguir fecha del hecho y de publicación');
  if (material.versiones_contradictorias) alertas.push('versiones contradictorias: exponer las dos');
  if (material.acusacion) alertas.push('acusación: atribuir a quien la hace');
  if (material.menores) alertas.push('menores: no identificar ni mostrar');
  if (material.victimas) alertas.push('víctimas: cuidado con el dolor como gancho');
  if (material.cifra_sin_denominador) alertas.push('cifra sin denominador: no publicar tal cual');
  return alertas;
}

/**
 * Checklist final antes de entregar.
 */
function controlFinal(pieza = {}) {
  const checks = {
    invento_datos: pieza.invento_datos === true,
    converti_version_en_hecho: pieza.converti_version_en_hecho === true,
    saque_atribucion: pieza.saque_atribucion === true,
    confundi_fechas: pieza.confundi_fechas === true,
    afirme_causalidad: pieza.afirme_causalidad === true,
    agregue_contexto_externo: pieza.agregue_contexto_externo === true,
    exagere_titular: pieza.exagere_titular === true,
  };
  const fallos = Object.entries(checks).filter(([, v]) => v).map(([k]) => k);
  return {
    checks,
    aprobado: fallos.length === 0,
    fallos,
    instruccion: fallos.length === 0
      ? 'pieza lista para publicar'
      : `corregir antes de entregar: ${fallos.join(', ')}`,
  };
}

module.exports = {
  NIVELES_EV, clasificarEvidencia, lenguajeParaNivel,
  preguntasPrueba, verificarCifra, detectarAlertas, controlFinal,
};
