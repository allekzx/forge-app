/**
 * Phase 1 — Import du nouveau dataset (hasaneyldrm/exercises-dataset) avec
 * PRÉSERVATION DES IDS EXISTANTS.
 *
 * Objectif : ne jamais faire porter l'identité d'un exercice par l'id brut
 * de la source externe. `exercises.id` est utilisé tel quel comme clé de
 * liaison par workout_exercises/workout_sets/workout_template_exercises
 * (voir services/DatabaseService.ts) — le changer casserait l'historique
 * et les templates des utilisateurs.
 *
 * Stratégie :
 *  1. Charger le catalogue actuel (assets/data/generatedExercises.ts).
 *  2. Charger le nouveau dataset (data/exercises.json, fetch ou --input local).
 *  3. Pour chaque exercice du nouveau dataset, chercher une correspondance
 *     par nom normalisé dans le catalogue actuel.
 *     - Match trouvé  → on GARDE l'id, le name, le muscle, l'equipment et
 *       l'image actuels (aucune régression), on attache juste la fiche
 *       source (sourceId/sourceRecord) pour les phases suivantes (3: médias,
 *       4: instructions FR natives).
 *     - Pas de match  → nouvel exercice, id namespacé `hgd_<id>` (jamais de
 *       collision avec les slugs ou `wger_*` existants), muscle/equipment
 *       mappés vers la taxonomie de l'app.
 *  4. (optionnel, --download-media) Télécharge en local le jpg + le gif de
 *     chaque exercice ayant une fiche source, dans assets/exercise_images/
 *     et assets/exercise_gifs/, puis régénère les maps require() associées
 *     (voir ATTRIBUTIONS.md pour la décision d'embarquer ces médias).
 *  5. Écrit un fichier CANDIDAT par défaut (pas d'écrasement de
 *     generatedExercises.ts), ou directement en production avec --promote.
 *     Écrit aussi un rapport de diff, et ÉCHOUE si un id protégé
 *     (Phase 0, scripts/audit-exercise-ids.js) disparaît.
 *
 * Run:
 *   node scripts/import-exercises-dataset.js --input /path/to/exercises.json
 *   node scripts/import-exercises-dataset.js            (fetch depuis GitHub)
 *   node scripts/import-exercises-dataset.js --download-media --promote
 */

const fs = require('fs');
const https = require('https');
const path = require('path');
const { loadInitialExercises, normName } = require('./lib/loadExerciseSource');

const DATASET_RAW_URL =
  'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/data/exercises.json';
const DATASET_MEDIA_BASE = 'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/';

const GENERATED_PATH = path.join(__dirname, '../assets/data/generatedExercises.ts');
const AUDIT_PATH = path.join(__dirname, '../.data-migration/exercise-audit.json');
const CANDIDATE_OUT_PATH = path.join(__dirname, '../.data-migration/generatedExercises.candidate.ts');
const REPORT_OUT_PATH = path.join(__dirname, '../.data-migration/import-report.json');
const IMAGE_DIR = path.join(__dirname, '../assets/exercise_images');
const GIF_DIR = path.join(__dirname, '../assets/exercise_gifs');
const IMAGE_MAP_PATH = path.join(__dirname, '../assets/data/exerciseImageMap.ts');
const GIF_MAP_PATH = path.join(__dirname, '../assets/data/exerciseGifMap.ts');
const ID_NAMESPACE = 'hgd_'; // "hasaneyldrm gym dataset" — namespace dédié, jamais utilisé ailleurs
const DOWNLOAD_CONCURRENCY = 16;

// ─── Mappings taxonomie (nouveau dataset → valeurs déjà utilisées par l'app) ──
// Les valeurs de droite DOIVENT rester dans l'ensemble déjà consommé par
// app/(tabs)/exercises.tsx (CATEGORY_MUSCLES) et constants/translations.ts
// (MUSCLE_LABELS), sous peine de rendre les nouveaux exercices invisibles
// dans les filtres par catégorie.
const TARGET_TO_MUSCLE = {
  abductors: 'Abductors',
  abs: 'Abdominals',
  adductors: 'Adductors',
  biceps: 'Biceps',
  calves: 'Calves',
  'cardiovascular system': 'Abdominals', // même fallback que import-wger-exercises.js pour 'Cardio'
  delts: 'Shoulders',
  forearms: 'Forearms',
  glutes: 'Glutes',
  hamstrings: 'Hamstrings',
  lats: 'Lats',
  'levator scapulae': 'Traps',
  pectorals: 'Chest',
  quads: 'Quadriceps',
  'serratus anterior': 'Chest',
  spine: 'Lower back',
  traps: 'Traps',
  triceps: 'Triceps',
  'upper back': 'Middle back',
};

const EQUIPMENT_MAP = {
  'body weight': 'Body only',
  cable: 'Cable',
  'leverage machine': 'Machine',
  assisted: 'Machine',
  'medicine ball': 'Medicine ball',
  'stability ball': 'Exercise ball',
  band: 'Bands',
  barbell: 'Barbell',
  rope: 'Other',
  dumbbell: 'Dumbbell',
  'ez barbell': 'E-z curl bar',
  'sled machine': 'Machine',
  'upper body ergometer': 'Machine',
  kettlebell: 'Kettlebells',
  'olympic barbell': 'Barbell',
  weighted: 'Other',
  'bosu ball': 'Exercise ball',
  'resistance band': 'Bands',
  roller: 'Foam roll',
  'skierg machine': 'Machine',
  hammer: 'Other',
  'smith machine': 'Machine',
  'wheel roller': 'Foam roll',
  'stationary bike': 'Machine',
  tire: 'Other',
  'trap bar': 'Barbell',
  'elliptical machine': 'Machine',
  'stepmill machine': 'Machine',
};

function mapMuscle(sourceEx) {
  return TARGET_TO_MUSCLE[sourceEx.target] ?? 'Abdominals';
}

function mapEquipment(sourceEx) {
  return EQUIPMENT_MAP[sourceEx.equipment] ?? 'Other';
}

/**
 * Décision (voir ATTRIBUTIONS.md) : les médias © Gym visual du nouveau
 * dataset sont téléchargés et embarqués localement (assets/exercise_images,
 * assets/exercise_gifs), jamais référencés par une URL distante ou un
 * chemin relatif au dépôt source (l'app doit fonctionner hors ligne).
 * Ce garde-fou détecte toute valeur `image`/`gif` qui ressemblerait encore
 * à un chemin distant (contient un `/` ou commence par `http`) — signe
 * qu'un téléchargement a été oublié ou a échoué silencieusement.
 */
function findLeakedMediaPaths(output) {
  const looksRemote = v => typeof v === 'string' && (v.includes('/') || /^https?:/i.test(v));
  return output.filter(ex => looksRemote(ex.image) || looksRemote(ex.gif));
}

/**
 * Phase 4 — Extrait les instructions françaises natives du nouveau dataset
 * pour un exercice source, dans la même convention que le catalogue actuel
 * (voir import-wger-exercises.js) : `description` = première étape,
 * `instructions` = toutes les étapes jointes par des retours à la ligne.
 * Retourne `null` si le dataset ne fournit pas de FR pour cet exercice.
 */
function extractFrenchInstructions(sourceEx) {
  const steps = sourceEx.instruction_steps?.fr;
  if (Array.isArray(steps) && steps.length > 0) {
    return { description: steps[0], instructions: steps.join('\n') };
  }
  const text = sourceEx.instructions?.fr;
  if (typeof text === 'string' && text.trim()) {
    return { description: text, instructions: text };
  }
  return null;
}

/**
 * Phase 4 — Décide s'il faut combler description/instructions d'un exercice
 * DÉJÀ existant (matché) avec le FR natif du nouveau dataset : uniquement
 * si le contenu actuel est vide. Ne remplace jamais un contenu déjà
 * présent (potentiellement déjà relu/édité par l'équipe).
 * Retourne { description, instructions, wasEnriched }.
 */
function resolveMatchedContent(existing, sourceEx) {
  const hasContent = (existing.description ?? '').trim() && (existing.instructions ?? '').trim();
  if (hasContent) {
    return { description: existing.description, instructions: existing.instructions, wasEnriched: false };
  }
  const fr = extractFrenchInstructions(sourceEx);
  if (!fr) {
    return { description: existing.description, instructions: existing.instructions, wasEnriched: false };
  }
  return { description: fr.description, instructions: fr.instructions, wasEnriched: true };
}

function titleCase(name) {
  return name.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1));
}

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'ForgeApp/1.0 data-import' } }, res => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          resolve(fetchJSON(res.headers.location));
          return;
        }
        let data = '';
        res.on('data', c => (data += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`JSON parse failed for ${url}: ${e.message}`));
          }
        });
        res.on('error', reject);
      })
      .on('error', reject);
  });
}

/** Télécharge un fichier binaire vers destPath, en suivant les redirections. Ne réécrit pas si déjà présent. */
function downloadBinary(url, destPath) {
  return new Promise(resolve => {
    if (fs.existsSync(destPath) && fs.statSync(destPath).size > 0) {
      resolve(true);
      return;
    }
    https
      .get(url, { headers: { 'User-Agent': 'ForgeApp/1.0 media-import' } }, res => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          downloadBinary(res.headers.location, destPath).then(resolve);
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          resolve(false);
          return;
        }
        const file = fs.createWriteStream(destPath);
        res.pipe(file);
        file.on('finish', () => file.close(() => resolve(true)));
        file.on('error', () => {
          try { fs.unlinkSync(destPath); } catch { /* noop */ }
          resolve(false);
        });
      })
      .on('error', () => resolve(false));
  });
}

/** Exécute `items` avec au plus `limit` tâches `worker` en vol simultanément. */
async function runWithConcurrency(items, limit, worker) {
  let cursor = 0;
  const results = new Array(items.length);
  async function runOne() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runOne));
  return results;
}

/**
 * Phase 3 (médias) — télécharge en local, pour chaque exercice qui a une
 * fiche source (`sourceId`), le jpg (si absent) et le gif d'illustration du
 * nouveau dataset. Le nom de fichier local est dérivé de l'id APP (jamais
 * de l'id source), donc stable et sans collision avec les assets existants.
 * Mute `output` en place (image/gif) et retourne des compteurs.
 */
async function downloadMedia(output, sourceById) {
  fs.mkdirSync(IMAGE_DIR, { recursive: true });
  fs.mkdirSync(GIF_DIR, { recursive: true });

  const withSource = output.filter(ex => ex.sourceId && sourceById.has(ex.sourceId));
  console.log(`\nTéléchargement des médias pour ${withSource.length} exercice(s)...`);

  let imagesDownloaded = 0;
  let gifsDownloaded = 0;
  let failures = 0;
  let done = 0;

  await runWithConcurrency(withSource, DOWNLOAD_CONCURRENCY, async ex => {
    const sourceEx = sourceById.get(ex.sourceId);

    if (!ex.image && sourceEx.image) {
      const filename = `${ex.id}.jpg`;
      const ok = await downloadBinary(DATASET_MEDIA_BASE + sourceEx.image, path.join(IMAGE_DIR, filename));
      if (ok) { ex.image = filename; imagesDownloaded++; } else { failures++; }
    }

    if (!ex.gif && sourceEx.gif_url) {
      const filename = `${ex.id}.gif`;
      const ok = await downloadBinary(DATASET_MEDIA_BASE + sourceEx.gif_url, path.join(GIF_DIR, filename));
      if (ok) { ex.gif = filename; gifsDownloaded++; } else { failures++; }
    }

    done++;
    if (done % 100 === 0 || done === withSource.length) {
      process.stdout.write(`  ${done}/${withSource.length} traités (${imagesDownloaded} jpg, ${gifsDownloaded} gif, ${failures} échecs)\r\n`);
    }
  });

  return { imagesDownloaded, gifsDownloaded, failures };
}

/** Régénère assets/data/exerciseImageMap.ts et exerciseGifMap.ts depuis le contenu réel des dossiers d'assets. */
function regenerateMediaMaps() {
  const buildMap = (dir, mapPath, aliasDir) => {
    const files = fs.existsSync(dir)
      ? fs.readdirSync(dir).filter(f => /\.(jpg|jpeg|png|gif)$/i.test(f)).sort()
      : [];
    const content =
      `import { ImageSourcePropType } from 'react-native';\n\n` +
      `// Généré par scripts/import-exercises-dataset.js --download-media — ne pas éditer à la main.\n` +
      `const map: Record<string, ImageSourcePropType> = {\n` +
      files.map(f => `  ${JSON.stringify(f)}: require(${JSON.stringify(`${aliasDir}/${f}`)}),`).join('\n') +
      `\n};\n\nexport default map;\n`;
    fs.writeFileSync(mapPath, content, 'utf-8');
    return files.length;
  };

  const imageCount = buildMap(IMAGE_DIR, IMAGE_MAP_PATH, '@/assets/exercise_images');
  const gifCount = buildMap(GIF_DIR, GIF_MAP_PATH, '@/assets/exercise_gifs');
  console.log(`✓ exerciseImageMap.ts régénéré (${imageCount} images)`);
  console.log(`✓ exerciseGifMap.ts régénéré (${gifCount} gifs)`);
}

async function loadNewDataset() {
  const inputArgIdx = process.argv.indexOf('--input');
  if (inputArgIdx !== -1 && process.argv[inputArgIdx + 1]) {
    const inputPath = process.argv[inputArgIdx + 1];
    console.log(`Lecture du dataset local : ${inputPath}`);
    return JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
  }
  console.log(`Téléchargement du dataset : ${DATASET_RAW_URL}`);
  return fetchJSON(DATASET_RAW_URL);
}

function buildMatchIndex(currentCatalog) {
  const exact = new Map(); // normName(name) -> exercise
  for (const ex of currentCatalog) {
    const key = normName(ex.name);
    if (!exact.has(key)) exact.set(key, ex);
  }
  return exact;
}

/**
 * Correspondance STRICTE (nom normalisé exact) uniquement.
 *
 * import-wger-exercises.js utilise en plus un matching par inclusion
 * ("prefix contains") — testé ici sur le vrai dataset, cette heuristique
 * fait s'effondrer des dizaines d'exercices distincts (ex: "Sit-Up",
 * "Weighted Sit-Up", "Decline Sit-Up"...) sur un seul id existant, ce qui
 * romprait leur identité. On préfère classer un exercice comme "nouveau"
 * (id namespacé, jamais de collision) plutôt que de risquer une fusion
 * incorrecte de deux exercices différents sous le même id.
 */
function findMatch(sourceName, exactIndex) {
  return exactIndex.get(normName(sourceName)) ?? null;
}

async function main() {
  if (!fs.existsSync(AUDIT_PATH)) {
    console.error(`✗ Rapport d'audit manquant (${AUDIT_PATH}). Lance d'abord: npm run audit:exercise-ids`);
    process.exit(1);
  }
  const audit = JSON.parse(fs.readFileSync(AUDIT_PATH, 'utf-8'));
  const protectedIds = new Set(audit.protectedIds);
  // Le seul id protégé qui ne vit pas dans generatedExercises.ts (il est seedé
  // directement en DB, is_custom=1) — on ne l'attend pas dans le fichier candidat.
  const idsExpectedInCatalogFile = new Set(protectedIds);
  for (const customId of audit.customSeedIds) idsExpectedInCatalogFile.delete(customId);

  const currentCatalog = loadInitialExercises(GENERATED_PATH);

  // Le script n'est PAS idempotent face à sa propre sortie : le relancer sur
  // un catalogue déjà promu (--promote) réutiliserait les entrées hgd_* déjà
  // fusionnées comme "catalogue actuel", les ferait re-matcher le dataset,
  // et produirait des ids en double. On détecte ce cas et on arrête net.
  if (currentCatalog.some(ex => ex.source === 'hasaneyldrm/exercises-dataset')) {
    console.error(
      `✗ ${GENERATED_PATH} contient déjà des entrées fusionnées (source: hasaneyldrm/exercises-dataset).\n` +
      `  Ce script attend le catalogue D'AVANT la fusion. Restaure-le d'abord (ex: git checkout -- ${path.relative(process.cwd(), GENERATED_PATH)}) avant de relancer.`
    );
    process.exit(1);
  }

  const exactIndex = buildMatchIndex(currentCatalog);

  const newDataset = await loadNewDataset();
  console.log(`→ ${newDataset.length} exercices dans le nouveau dataset`);

  const output = [];
  const usedCurrentIds = new Set();
  let matched = 0;
  let added = 0;
  let enrichedExisting = 0;
  const unmatchedSample = [];

  for (const sourceEx of newDataset) {
    // Un id existant ne peut être réclamé qu'une seule fois : si deux entrées
    // du nouveau dataset normalisent vers le même nom, la première gagne le
    // match, la suivante devient un nouvel exercice (jamais de doublon d'id).
    const match = findMatch(sourceEx.name, exactIndex);
    if (match && !usedCurrentIds.has(match.id)) {
      matched++;
      usedCurrentIds.add(match.id);
      const resolved = resolveMatchedContent(match, sourceEx);
      if (resolved.wasEnriched) enrichedExisting++;
      output.push({
        id: match.id, // ← JAMAIS modifié
        name: match.name,
        muscle: match.muscle,
        equipment: match.equipment,
        image: match.image,
        gif: match.gif ?? null,
        description: resolved.description,
        instructions: resolved.instructions,
        source: 'hasaneyldrm/exercises-dataset',
        sourceId: sourceEx.id,
      });
    } else {
      added++;
      if (unmatchedSample.length < 15) unmatchedSample.push(sourceEx.name);
      const fr = extractFrenchInstructions(sourceEx);
      output.push({
        id: `${ID_NAMESPACE}${sourceEx.id}`,
        name: titleCase(sourceEx.name),
        muscle: mapMuscle(sourceEx),
        equipment: mapEquipment(sourceEx),
        image: null, // rempli par --download-media
        gif: null, // rempli par --download-media
        description: fr ? fr.description : '',
        instructions: fr ? fr.instructions : '',
        source: 'hasaneyldrm/exercises-dataset',
        sourceId: sourceEx.id,
      });
    }
  }

  // Exercices du catalogue actuel qu'aucun exercice du nouveau dataset n'a
  // matché : on les CONSERVE tels quels (id, contenu inchangés) — ce sont
  // potentiellement des exercices déjà en usage dans des séances utilisateur.
  let carriedOverUnmatched = 0;
  for (const ex of currentCatalog) {
    if (!usedCurrentIds.has(ex.id)) {
      carriedOverUnmatched++;
      output.push({
        id: ex.id,
        name: ex.name,
        muscle: ex.muscle,
        equipment: ex.equipment,
        image: ex.image,
        gif: ex.gif ?? null,
        description: ex.description,
        instructions: ex.instructions,
        source: 'legacy',
        sourceId: null,
      });
    }
  }

  // ─── Téléchargement des médias (jpg + gif) ────────────────────────────────
  let mediaStats = null;
  if (process.argv.includes('--download-media')) {
    const sourceById = new Map(newDataset.map(e => [e.id, e]));
    mediaStats = await downloadMedia(output, sourceById);
    regenerateMediaMaps();
  }

  // ─── Validation : aucun id protégé ne doit disparaître ───────────────────
  const outputIds = new Set(output.map(e => e.id));
  const missingProtectedIds = [...idsExpectedInCatalogFile].filter(id => !outputIds.has(id));
  const duplicateIds = [];
  {
    const seen = new Set();
    for (const ex of output) {
      if (seen.has(ex.id)) duplicateIds.push(ex.id);
      seen.add(ex.id);
    }
  }

  // ─── Phase 3 : garde-fou attribution médias ──────────────────────────────
  // Décision (voir ATTRIBUTIONS.md) : les images/gifs © Gym visual sont
  // téléchargées et embarquées localement (--download-media), avec mention
  // d'attribution dans l'app (Paramètres → À propos). On vérifie ici,
  // mécaniquement, qu'aucune valeur `image`/`gif` ne ressemble encore à un
  // chemin ou une URL distante — signe d'un téléchargement manqué.
  const leakedMediaPaths = findLeakedMediaPaths(output);
  const withImage = output.filter(ex => ex.image).length;
  const withoutImage = output.length - withImage;
  const withGif = output.filter(ex => ex.gif).length;

  // ─── Phase 4 : garde-fou instructions FR ─────────────────────────────────
  // Un exercice nouvellement ajouté (id hgd_*) ne devrait jamais rester sans
  // instructions puisque le dataset source fournit du FR natif pour la quasi
  // totalité de ses entrées — un compte non nul ici mérite d'être regardé.
  const newWithoutInstructions = output.filter(
    ex => ex.id.startsWith(ID_NAMESPACE) && !(ex.instructions ?? '').trim()
  ).length;

  const report = {
    generatedAt: new Date().toISOString(),
    newDatasetCount: newDataset.length,
    currentCatalogCount: currentCatalog.length,
    matched,
    added,
    carriedOverUnmatched,
    enrichedExisting,
    outputCount: output.length,
    withImage,
    withoutImage,
    withGif,
    mediaStats,
    newWithoutInstructions,
    missingProtectedIds,
    duplicateIds,
    leakedMediaPaths: leakedMediaPaths.map(e => ({ id: e.id, image: e.image, gif: e.gif })),
    unmatchedSample,
  };
  fs.mkdirSync(path.dirname(REPORT_OUT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_OUT_PATH, JSON.stringify(report, null, 2));

  console.log(`\n=== Rapport d'import ===`);
  console.log(`Matchés (id conservé)         : ${matched}`);
  console.log(`Nouveaux (id ${ID_NAMESPACE}*)          : ${added}`);
  console.log(`Conservés sans match (legacy) : ${carriedOverUnmatched}`);
  console.log(`Total sortie                  : ${output.length}`);
  console.log(`Avec image                    : ${withImage}`);
  console.log(`Sans image                    : ${withoutImage}`);
  console.log(`Avec gif                      : ${withGif}`);
  console.log(`Enrichis en FR (existants, étaient vides) : ${enrichedExisting}`);
  console.log(`Nouveaux sans instructions FR : ${newWithoutInstructions}`);

  let failed = false;
  if (missingProtectedIds.length) {
    console.error(`\n✗ ${missingProtectedIds.length} id(s) protégé(s) disparaîtraient : ${missingProtectedIds.slice(0, 20).join(', ')}${missingProtectedIds.length > 20 ? '...' : ''}`);
    failed = true;
  }
  if (duplicateIds.length) {
    console.error(`\n✗ ${duplicateIds.length} id(s) en double dans la sortie : ${duplicateIds.slice(0, 20).join(', ')}`);
    failed = true;
  }
  if (leakedMediaPaths.length) {
    console.error(`\n✗ ${leakedMediaPaths.length} exercice(s) porteraient un chemin média du nouveau dataset (© Gym visual) sans revue de licence : ${leakedMediaPaths.slice(0, 10).map(e => e.id).join(', ')}`);
    failed = true;
  }
  if (failed) {
    console.error(`\nAucun fichier candidat écrit — corriger avant de relancer.`);
    process.exit(1);
  }

  const toRow = ex => `  {
    id: ${JSON.stringify(ex.id)},
    name: ${JSON.stringify(ex.name)},
    muscle: ${JSON.stringify(ex.muscle)},
    equipment: ${JSON.stringify(ex.equipment)},
    image: ${ex.image ? JSON.stringify(ex.image) : 'null'},
    gif: ${ex.gif ? JSON.stringify(ex.gif) : 'null'},
    description: ${JSON.stringify(ex.description)},
    instructions: ${JSON.stringify(ex.instructions)},
    source: ${JSON.stringify(ex.source)},
    sourceId: ${ex.sourceId ? JSON.stringify(ex.sourceId) : 'null'},
  }`;

  const promote = process.argv.includes('--promote');
  const outPath = promote ? GENERATED_PATH : CANDIDATE_OUT_PATH;

  const typeDecl = `export type ExerciseSeed = {
  id: string;
  name: string;
  muscle: string;
  equipment: string;
  image: string | null;
  gif: string | null;
  description: string;
  instructions: string;
  source: string;
  sourceId: string | null;
};\n`;

  // Découpé en lots typés (const partN: ExerciseSeed[] = [...]) puis
  // concaténés, plutôt qu'un seul littéral de 2000+ objets : TypeScript
  // échoue à typer un littéral aussi gros en un bloc ("Expression produces
  // a union type that is too complex to represent"), que ce soit via une
  // annotation sur la variable ou une assertion `as`. Des lots plus petits
  // restent sous son budget de complexité ; la concaténation de tableaux
  // déjà typés, elle, est triviale à vérifier.
  const CHUNK_FOR_TS = 200;
  const parts = [];
  for (let i = 0; i < output.length; i += CHUNK_FOR_TS) {
    const chunk = output.slice(i, i + CHUNK_FOR_TS);
    parts.push(`const part${parts.length}: ExerciseSeed[] = [\n${chunk.map(toRow).join(',\n')}\n];`);
  }
  const partNames = parts.map((_, i) => `...part${i}`).join(', ');
  const body = `\n${typeDecl}\n${parts.join('\n\n')}\n\nexport const initialExercises: ExerciseSeed[] = [${partNames}];\n`;

  fs.writeFileSync(outPath, body);

  console.log(`\n✓ Rapport écrit : ${REPORT_OUT_PATH}`);
  if (promote) {
    console.log(`✓ Catalogue promu en production : ${outPath}`);
  } else {
    console.log(`✓ Fichier candidat écrit : ${outPath}`);
    console.log(`\n(Ce fichier candidat ne remplace PAS encore assets/data/generatedExercises.ts —`);
    console.log(` relance avec --promote pour l'écrire directement en production.)`);
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error('\n✗ Erreur:', err.message);
    process.exit(1);
  });
}

module.exports = {
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
};
