/**
 * Consolide les doublons entre les anciens exercices non appariés
 * ("legacy", 805 après la fusion — voir scripts/import-exercises-dataset.js)
 * et les nouveaux exercices ajoutés (`hgd_*`) qui décrivent en fait le même
 * mouvement sous un nom légèrement différent.
 *
 * Décision produit (discutée avec l'utilisateur après un premier passage
 * trop permissif du matching par inclusion en Phase 1 — voir
 * import-exercises-dataset.js) : ne fusionner QUE les paires à très haute
 * confiance (score de Jaccard sur les mots ≥ 0.9, même muscle, même
 * équipement). En dessous, l'ambiguïté est réelle et un mot comme
 * "seated"/"decline"/"standing" change l'exercice sans changer beaucoup le
 * score de similarité textuelle — on préfère garder deux entrées séparées
 * plutôt que de fusionner deux exercices différents par erreur.
 *
 * Comme en Phase 1 : l'id LEGACY est conservé (c'est lui qui peut être
 * référencé par des séances/templates existants), le contenu enrichi
 * (gif, et description/instructions si vides) vient du côté `hgd_*`, qui
 * est ensuite retiré du catalogue. Le gif déjà téléchargé sous le nom
 * `hgd_XXXX.gif` est renommé vers `<id legacy>.gif` ; le jpg `hgd_XXXX.jpg`
 * (devenu inutile, l'entrée legacy garde sa propre image) est supprimé.
 *
 * La suppression réelle des entrées `hgd_*` fusionnées, côté base SQLite
 * des appareils déjà migrés, passe par le même mécanisme sûr que d'habitude
 * (services/exerciseMigration.ts : un id absent du nouveau catalogue n'est
 * supprimé que s'il n'est référencé nulle part) — on ne réinvente rien ici,
 * on fournit juste un catalogue plus petit et on bump la version.
 *
 * Run: node scripts/consolidate-duplicate-exercises.js [--apply]
 *   (sans --apply : dry-run, affiche seulement le rapport)
 */

const fs = require('fs');
const path = require('path');
const { loadInitialExercises, jaccardWordSimilarity } = require('./lib/loadExerciseSource');

const GENERATED_PATH = path.join(__dirname, '../assets/data/generatedExercises.ts');
const IMAGE_DIR = path.join(__dirname, '../assets/exercise_images');
const GIF_DIR = path.join(__dirname, '../assets/exercise_gifs');
const IMAGE_MAP_PATH = path.join(__dirname, '../assets/data/exerciseImageMap.ts');
const GIF_MAP_PATH = path.join(__dirname, '../assets/data/exerciseGifMap.ts');
const REPORT_PATH = path.join(__dirname, '../.data-migration/dedup-report.json');

const SIMILARITY_THRESHOLD = 0.9;
const NEW_ID_PREFIX = 'hgd_';

/**
 * Trouve les paires (legacy, new) à très haute confiance : même muscle,
 * même équipement, similarité de mots >= threshold. Appariement glouton
 * (score décroissant) pour garantir qu'un exercice ne soit jamais utilisé
 * dans plus d'une paire.
 */
function findSafeDuplicatePairs(legacyEntries, newEntries, threshold = SIMILARITY_THRESHOLD) {
  const candidates = [];
  const byMuscleEquipment = new Map();
  for (const n of newEntries) {
    const key = `${n.muscle}|${n.equipment}`;
    if (!byMuscleEquipment.has(key)) byMuscleEquipment.set(key, []);
    byMuscleEquipment.get(key).push(n);
  }

  for (const legacy of legacyEntries) {
    const pool = byMuscleEquipment.get(`${legacy.muscle}|${legacy.equipment}`) || [];
    for (const candidate of pool) {
      const score = jaccardWordSimilarity(legacy.name, candidate.name);
      if (score >= threshold) {
        candidates.push({ legacyId: legacy.id, newId: candidate.id, score });
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  const usedLegacy = new Set();
  const usedNew = new Set();
  const pairs = [];
  for (const c of candidates) {
    if (usedLegacy.has(c.legacyId) || usedNew.has(c.newId)) continue;
    usedLegacy.add(c.legacyId);
    usedNew.add(c.newId);
    pairs.push(c);
  }
  return pairs;
}

/** Sérialisation identique à import-exercises-dataset.js (voir ce fichier pour le pourquoi du découpage en lots). */
function serializeCatalog(exercises) {
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

  const CHUNK_FOR_TS = 200;
  const parts = [];
  for (let i = 0; i < exercises.length; i += CHUNK_FOR_TS) {
    const chunk = exercises.slice(i, i + CHUNK_FOR_TS);
    parts.push(`const part${parts.length}: ExerciseSeed[] = [\n${chunk.map(toRow).join(',\n')}\n];`);
  }
  const partNames = parts.map((_, i) => `...part${i}`).join(', ');
  return `\n${typeDecl}\n${parts.join('\n\n')}\n\nexport const initialExercises: ExerciseSeed[] = [${partNames}];\n`;
}

function regenerateMediaMaps() {
  const buildMap = (dir, mapPath, aliasDir) => {
    const files = fs.existsSync(dir)
      ? fs.readdirSync(dir).filter(f => /\.(jpg|jpeg|png|gif)$/i.test(f)).sort()
      : [];
    const content =
      `import { ImageSourcePropType } from 'react-native';\n\n` +
      `// Généré par scripts/import-exercises-dataset.js / consolidate-duplicate-exercises.js — ne pas éditer à la main.\n` +
      `const map: Record<string, ImageSourcePropType> = {\n` +
      files.map(f => `  ${JSON.stringify(f)}: require(${JSON.stringify(`${aliasDir}/${f}`)}),`).join('\n') +
      `\n};\n\nexport default map;\n`;
    fs.writeFileSync(mapPath, content, 'utf-8');
    return files.length;
  };
  const imageCount = buildMap(IMAGE_DIR, IMAGE_MAP_PATH, '@/assets/exercise_images');
  const gifCount = buildMap(GIF_DIR, GIF_MAP_PATH, '@/assets/exercise_gifs');
  return { imageCount, gifCount };
}

function main() {
  const apply = process.argv.includes('--apply');
  const catalog = loadInitialExercises(GENERATED_PATH);

  const legacyEntries = catalog.filter(e => e.source === 'legacy');
  const newEntries = catalog.filter(e => e.id.startsWith(NEW_ID_PREFIX));
  console.log(`Legacy (anciens non appariés) : ${legacyEntries.length}`);
  console.log(`Nouveaux (${NEW_ID_PREFIX}*)             : ${newEntries.length}`);

  const pairs = findSafeDuplicatePairs(legacyEntries, newEntries);
  console.log(`\nPaires à très haute confiance (score >= ${SIMILARITY_THRESHOLD}) : ${pairs.length}`);

  const legacyById = new Map(catalog.map(e => [e.id, e]));
  const report = { generatedAt: new Date().toISOString(), threshold: SIMILARITY_THRESHOLD, pairs: [] };

  const newIdsToRemove = new Set();
  for (const pair of pairs) {
    const legacy = legacyById.get(pair.legacyId);
    const fresh = legacyById.get(pair.newId);
    report.pairs.push({
      legacyId: legacy.id, legacyName: legacy.name,
      newId: fresh.id, newName: fresh.name,
      score: Number(pair.score.toFixed(3)),
    });
    console.log(`  [${pair.score.toFixed(2)}] ${legacy.name}  <-  ${fresh.name}  (${legacy.id} <- ${fresh.id})`);

    // Fusion : l'id/name/muscle/equipment/image legacy sont conservés
    // (même politique que le matching exact de la Phase 1) ; on adopte le
    // gif du nouveau, et on ne comble description/instructions que si
    // elles sont vides côté legacy.
    legacy.gif = fresh.gif ?? legacy.gif ?? null;
    const legacyHasContent = (legacy.description ?? '').trim() && (legacy.instructions ?? '').trim();
    if (!legacyHasContent) {
      legacy.description = fresh.description;
      legacy.instructions = fresh.instructions;
    }
    legacy.source = 'hasaneyldrm/exercises-dataset';
    legacy.sourceId = fresh.sourceId;

    newIdsToRemove.add(fresh.id);
  }

  const finalCatalog = catalog.filter(e => !newIdsToRemove.has(e.id));
  console.log(`\nCatalogue : ${catalog.length} -> ${finalCatalog.length} exercices (${pairs.length} doublons consolidés)`);

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(`\nRapport écrit : ${REPORT_PATH}`);

  if (!apply) {
    console.log(`\n(dry-run — relance avec --apply pour écrire le catalogue et déplacer les fichiers média)`);
    return;
  }

  // Renomme le gif fusionné vers le nom de fichier legacy, supprime le jpg
  // hgd_* devenu inutile (l'entrée legacy garde sa propre image).
  for (const pair of pairs) {
    const legacy = legacyById.get(pair.legacyId);
    const oldGifPath = path.join(GIF_DIR, `${pair.newId}.gif`);
    const newGifPath = path.join(GIF_DIR, `${legacy.id}.gif`);
    if (fs.existsSync(oldGifPath)) {
      fs.renameSync(oldGifPath, newGifPath);
      legacy.gif = `${legacy.id}.gif`;
    }
    const orphanJpgPath = path.join(IMAGE_DIR, `${pair.newId}.jpg`);
    if (fs.existsSync(orphanJpgPath)) fs.unlinkSync(orphanJpgPath);
  }

  fs.writeFileSync(GENERATED_PATH, serializeCatalog(finalCatalog));
  console.log(`✓ Catalogue écrit : ${GENERATED_PATH}`);

  const mediaCounts = regenerateMediaMaps();
  console.log(`✓ exerciseImageMap.ts régénéré (${mediaCounts.imageCount} images)`);
  console.log(`✓ exerciseGifMap.ts régénéré (${mediaCounts.gifCount} gifs)`);
}

if (require.main === module) {
  main();
}

module.exports = { findSafeDuplicatePairs, serializeCatalog, SIMILARITY_THRESHOLD };
