/**
 * Tests de la logique de correspondance/mapping du script Phase 1
 * (scripts/import-exercises-dataset.js). Vérifie en particulier la garantie
 * centrale : un exercice existant n'est jamais fusionné avec un nom
 * ambigu, et chaque muscle/equipment du nouveau dataset retombe sur une
 * valeur déjà connue de l'app (sinon les filtres par catégorie de
 * app/(tabs)/exercises.tsx n'affichent plus l'exercice correctement).
 *
 * Run: node --test scripts/test/import-exercises-dataset.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  mapMuscle,
  mapEquipment,
  titleCase,
  findMatch,
  buildMatchIndex,
  findLeakedMediaPaths,
  extractFrenchInstructions,
  resolveMatchedContent,
  runWithConcurrency,
  TARGET_TO_MUSCLE,
  EQUIPMENT_MAP,
} = require('../import-exercises-dataset');

// Taxonomie réellement consommée par l'app (app/(tabs)/exercises.tsx :
// CATEGORY_MUSCLES) — toute valeur de mapping doit appartenir à cet ensemble.
const APP_MUSCLES = new Set([
  'Chest', 'Lats', 'Middle back', 'Lower back', 'Traps',
  'Quadriceps', 'Hamstrings', 'Glutes', 'Calves', 'Adductors', 'Abductors',
  'Biceps', 'Triceps', 'Forearms', 'Shoulders', 'Neck', 'Abdominals',
]);

test('mapMuscle: chaque valeur "target" connue du dataset mappe vers une valeur de muscle déjà utilisée par l\'app', () => {
  for (const [target, muscle] of Object.entries(TARGET_TO_MUSCLE)) {
    assert.ok(APP_MUSCLES.has(muscle), `target "${target}" mappe vers "${muscle}" qui n'est pas dans la taxonomie app`);
  }
});

test('mapMuscle: fallback sûr pour un target inconnu', () => {
  assert.equal(mapMuscle({ target: 'totally_unknown_target' }), 'Abdominals');
});

test('mapEquipment: aucun mapping ne doit produire une chaîne vide/undefined', () => {
  for (const [equip, mapped] of Object.entries(EQUIPMENT_MAP)) {
    assert.ok(typeof mapped === 'string' && mapped.length > 0, `equipment "${equip}" -> "${mapped}"`);
  }
});

test('mapEquipment: fallback "Other" pour un equipment inconnu', () => {
  assert.equal(mapEquipment({ equipment: 'jetpack' }), 'Other');
});

test('titleCase: capitalise chaque mot sans toucher à la casse interne', () => {
  assert.equal(titleCase('3/4 sit-up'), '3/4 Sit-up');
  assert.equal(titleCase('dumbbell decline one arm hammer press'), 'Dumbbell Decline One Arm Hammer Press');
});

test('findMatch: ne fusionne QUE sur un nom normalisé strictement identique', () => {
  const catalog = [
    { id: 'Sit-Up', name: 'Sit-Up' },
    { id: 'Barbell_Squat', name: 'Barbell Squat' },
  ];
  const index = buildMatchIndex(catalog);

  // Match exact (insensible à la casse/ponctuation)
  assert.equal(findMatch('sit up', index).id, 'Sit-Up');
  assert.equal(findMatch('Barbell Squat', index).id, 'Barbell_Squat');

  // Un nom seulement proche (contient/est contenu) NE DOIT PAS matcher —
  // sinon "Weighted Sit-Up" fusionnerait à tort avec "Sit-Up" et perdrait
  // son identité propre. C'est le bug reproduit et corrigé en Phase 1.
  assert.equal(findMatch('Weighted Sit-Up', index), null);
  assert.equal(findMatch('Decline Sit-Up', index), null);
  assert.equal(findMatch('Squat', index), null);
});

test('buildMatchIndex: garde la première entrée en cas de doublon de nom dans le catalogue', () => {
  const catalog = [
    { id: 'first', name: 'Duplicate Name' },
    { id: 'second', name: 'Duplicate Name' },
  ];
  const index = buildMatchIndex(catalog);
  assert.equal(findMatch('duplicate name', index).id, 'first');
});

test('findLeakedMediaPaths (Phase 3) : détecte un chemin/URL distant non téléchargé (image ou gif)', () => {
  const output = [
    { id: 'Barbell_Squat', image: 'Barbell_Squat.jpg', gif: null },       // local, OK
    { id: 'hgd_0042', image: null, gif: null },                           // rien, OK
    { id: 'hgd_0099', image: 'images/0099-Ab12Cd.jpg', gif: null },       // chemin relatif au dataset — pas téléchargé
    { id: 'hgd_0100', image: null, gif: 'videos/0100-Ef34Gh.gif' },       // idem côté gif
    { id: 'hgd_0101', image: 'https://example.com/x.jpg', gif: null },   // URL distante en dur
  ];
  const leaked = findLeakedMediaPaths(output);
  assert.deepEqual(leaked.map(e => e.id).sort(), ['hgd_0099', 'hgd_0100', 'hgd_0101']);
});

test('findLeakedMediaPaths (Phase 3) : aucun faux positif sur des noms de fichiers locaux plats (image + gif)', () => {
  const output = [
    { id: 'a', image: 'Barbell_Squat.jpg', gif: 'Barbell_Squat.gif' },
    { id: 'b', image: 'Reverse_Barbell_Curl.jpg', gif: null },
    { id: 'c', image: null, gif: null },
  ];
  assert.deepEqual(findLeakedMediaPaths(output), []);
});

test('extractFrenchInstructions (Phase 4) : utilise instruction_steps.fr en priorité (description = 1ère étape)', () => {
  const sourceEx = {
    instruction_steps: { fr: ['Allonge-toi sur le dos.', 'Lève le buste.', 'Redescends lentement.'] },
    instructions: { fr: 'Texte brut non utilisé si les étapes existent.' },
  };
  const result = extractFrenchInstructions(sourceEx);
  assert.equal(result.description, 'Allonge-toi sur le dos.');
  assert.equal(result.instructions, 'Allonge-toi sur le dos.\nLève le buste.\nRedescends lentement.');
});

test('extractFrenchInstructions (Phase 4) : repli sur instructions.fr si pas d\'étapes', () => {
  const sourceEx = { instruction_steps: {}, instructions: { fr: 'Un seul paragraphe FR.' } };
  const result = extractFrenchInstructions(sourceEx);
  assert.equal(result.description, 'Un seul paragraphe FR.');
  assert.equal(result.instructions, 'Un seul paragraphe FR.');
});

test('extractFrenchInstructions (Phase 4) : renvoie null si aucune traduction FR disponible', () => {
  assert.equal(extractFrenchInstructions({ instruction_steps: { en: ['x'] }, instructions: { en: 'x' } }), null);
  assert.equal(extractFrenchInstructions({}), null);
});

test('resolveMatchedContent (Phase 4) : comble un exercice existant dont le contenu est vide', () => {
  const existing = { description: '', instructions: '' };
  const sourceEx = { instruction_steps: { fr: ['Étape 1.', 'Étape 2.'] } };
  const result = resolveMatchedContent(existing, sourceEx);
  assert.equal(result.wasEnriched, true);
  assert.equal(result.description, 'Étape 1.');
  assert.equal(result.instructions, 'Étape 1.\nÉtape 2.');
});

test('resolveMatchedContent (Phase 4) : ne touche JAMAIS un contenu déjà présent', () => {
  const existing = { description: 'Ancienne description FR déjà éditée.', instructions: 'Anciennes instructions FR.' };
  const sourceEx = { instruction_steps: { fr: ['Nouvelle étape qui ne doit PAS remplacer.'] } };
  const result = resolveMatchedContent(existing, sourceEx);
  assert.equal(result.wasEnriched, false);
  assert.equal(result.description, 'Ancienne description FR déjà éditée.');
  assert.equal(result.instructions, 'Anciennes instructions FR.');
});

test('resolveMatchedContent (Phase 4) : reste vide si le dataset source n\'a pas non plus de FR', () => {
  const existing = { description: '', instructions: '' };
  const result = resolveMatchedContent(existing, { instruction_steps: { en: ['x'] } });
  assert.equal(result.wasEnriched, false);
  assert.equal(result.description, '');
  assert.equal(result.instructions, '');
});

test('runWithConcurrency: traite tous les items exactement une fois, dans l\'ordre des résultats', async () => {
  const items = Array.from({ length: 37 }, (_, i) => i);
  let maxInFlight = 0;
  let inFlight = 0;
  const seen = [];

  const results = await runWithConcurrency(items, 5, async n => {
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise(r => setTimeout(r, 1));
    seen.push(n);
    inFlight--;
    return n * 2;
  });

  assert.deepEqual(results, items.map(n => n * 2));
  assert.equal(seen.length, 37);
  assert.deepEqual([...seen].sort((a, b) => a - b), items);
  assert.ok(maxInFlight <= 5, `attendu <= 5 en vol simultanément, obtenu ${maxInFlight}`);
});

test('runWithConcurrency: limite > nombre d\'items ne casse rien', async () => {
  const results = await runWithConcurrency([1, 2, 3], 100, async n => n + 1);
  assert.deepEqual(results, [2, 3, 4]);
});

test('runWithConcurrency: liste vide', async () => {
  const results = await runWithConcurrency([], 5, async n => n);
  assert.deepEqual(results, []);
});
