#!/usr/bin/env node
/**
 * scripts/enrich-exercises.js
 *
 * Enrichit les exercices sans image depuis free-exercise-db
 * (https://github.com/yuhonas/free-exercise-db)
 *
 * Ce que fait ce script :
 *  1. Télécharge le catalogue JSON de free-exercise-db (800+ exercices, open source)
 *  2. Pour chaque exercice wger sans image dans generatedExercises.ts :
 *     - correspondance exacte par nom (normalisé)
 *     - fallback : similarité Jaccard sur les mots (seuil 0.65)
 *  3. Télécharge l'image 0.jpg depuis le repo GitHub → assets/exercise_images/
 *  4. Réécrit generatedExercises.ts avec les descriptions / instructions / images enrichies
 *  5. Régénère exerciseImageMap.ts pour inclure les nouvelles images
 *
 * Usage :
 *   node scripts/enrich-exercises.js
 *   node scripts/enrich-exercises.js --dry-run   (affiche les correspondances sans modifier les fichiers)
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// ── Chemins ────────────────────────────────────────────────────────────────────

const ROOT = path.join(__dirname, '..');
const GEN_EXERCISES_PATH = path.join(ROOT, 'assets/data/generatedExercises.ts');
const IMAGE_MAP_PATH = path.join(ROOT, 'assets/data/exerciseImageMap.ts');
const IMAGE_DIR = path.join(ROOT, 'assets/exercise_images');

const FREE_DB_JSON_URL =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';
const FREE_DB_IMAGE_BASE =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises';

const DRY_RUN = process.argv.includes('--dry-run');

// ── Utilitaires ────────────────────────────────────────────────────────────────

/** Normalise un nom pour la comparaison (bas de casse, sans ponctuation). */
function normalize(name) {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')   // retire (parenthèses)
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Similarité Jaccard sur les mots (0 = rien en commun, 1 = identique). */
function jaccard(a, b) {
  const wa = new Set(a.split(' ').filter(Boolean));
  const wb = new Set(b.split(' ').filter(Boolean));
  if (!wa.size || !wb.size) return 0;
  const inter = [...wa].filter(w => wb.has(w)).length;
  const union = new Set([...wa, ...wb]).size;
  return inter / union;
}

/** Télécharge un JSON depuis une URL HTTPS (suit les redirections). */
function fetchJSON(url, redirects = 5) {
  return new Promise((resolve, reject) => {
    if (redirects <= 0) { reject(new Error('Trop de redirections')); return; }
    https.get(url, { headers: { 'User-Agent': 'enrich-exercises-script/1.0' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        fetchJSON(res.headers.location, redirects - 1).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} pour ${url}`));
        return;
      }
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`JSON invalide : ${e.message}`)); }
      });
    }).on('error', reject);
  });
}

/**
 * Télécharge l'image 0.jpg d'un exercice free-exercise-db.
 * Retourne true si l'image a été téléchargée (ou existait déjà), false sinon.
 */
function downloadImage(freeId, destFilename) {
  return new Promise((resolve) => {
    const dest = path.join(IMAGE_DIR, destFilename);
    if (fs.existsSync(dest)) { resolve(true); return; }

    const url = `${FREE_DB_IMAGE_BASE}/${encodeURIComponent(freeId)}/0.jpg`;
    const file = fs.createWriteStream(dest);

    const cleanup = () => { try { fs.unlinkSync(dest); } catch {} };

    https.get(url, { headers: { 'User-Agent': 'enrich-exercises-script/1.0' } }, (res) => {
      if (res.statusCode !== 200) {
        file.destroy();
        cleanup();
        resolve(false);
        return;
      }
      res.pipe(file);
      file.on('finish', () => { file.close(() => resolve(true)); });
      file.on('error', () => { cleanup(); resolve(false); });
    }).on('error', () => { cleanup(); resolve(false); });
  });
}

/** Échappe une valeur pour l'écrire dans un fichier TS (string double-quote). */
function toTSString(value) {
  if (value == null || value === '') return '""';
  return `"${String(value)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, '\\n')}"`;
}

// ── Parsing de generatedExercises.ts ──────────────────────────────────────────

/**
 * Extrait chaque objet exercice du fichier TS.
 * Le format est très régulier (généré) : 7 champs dans l'ordre fixe.
 * Retourne un tableau d'objets avec l'index de début/fin dans le fichier.
 */
function parseExercisesTS(content) {
  const exercises = [];

  // Pattern : objet exercice complet (format strict du fichier auto-généré)
  //   {
  //     id: "...",
  //     name: "...",
  //     muscle: "...",
  //     equipment: "...",
  //     image: null  |  'file.jpg',
  //     description: "...",
  //     instructions: "...",
  //   }
  const pat = new RegExp(
    [
      /\{\s*\r?\n/,
      /\s+id:\s*"([^"]+)",\r?\n/,
      /\s+name:\s*"([^"]+)",\r?\n/,
      /\s+muscle:\s*"([^"]+)",\r?\n/,
      /\s+equipment:\s*"([^"]+)",\r?\n/,
      /\s+image:\s*(null|'[^']*'|"[^"]*"),\r?\n/,
      /\s+description:\s*(null|"(?:[^"\\]|\\.)*"),\r?\n/,
      /\s+instructions:\s*(null|"(?:[^"\\]|\\.)*"),\r?\n/,
      /\s+\}/,
    ].map(r => r.source).join(''),
    'g'
  );

  let m;
  while ((m = pat.exec(content)) !== null) {
    exercises.push({
      id:          m[1],
      name:        m[2],
      muscle:      m[3],
      equipment:   m[4],
      imageRaw:    m[5],           // 'null', "'file.jpg'", ou '"file.jpg"'
      hasImage:    m[5] !== 'null',
      descRaw:     m[6],           // '"texte"' ou 'null'
      instrRaw:    m[7],
      fullMatch:   m[0],
      start:       m.index,
      end:         m.index + m[0].length,
    });
  }

  return exercises;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🏋️  Enrichissement des exercices — free-exercise-db\n');
  if (DRY_RUN) console.log('  ⚠️  Mode --dry-run : aucun fichier ne sera modifié\n');

  // 1. Télécharger le catalogue free-exercise-db
  console.log('📥 Téléchargement du catalogue free-exercise-db...');
  let freeDb;
  try {
    freeDb = await fetchJSON(FREE_DB_JSON_URL);
  } catch (e) {
    console.error('❌ Impossible de récupérer free-exercise-db :', e.message);
    console.error('   Vérifie ta connexion internet et réessaie.');
    process.exit(1);
  }
  console.log(`✅ ${freeDb.length} exercices dans free-exercise-db`);

  // 2. Construire les tables de correspondance
  const exactMap = new Map();   // nom normalisé exact → exercice free-db
  const allNorm  = [];          // [{norm, ex}] pour fuzzy matching

  for (const ex of freeDb) {
    const norm = normalize(ex.name);
    if (!exactMap.has(norm)) exactMap.set(norm, ex);
    allNorm.push({ norm, ex });
    for (const alias of (ex.aliases || [])) {
      const an = normalize(alias);
      if (!exactMap.has(an)) exactMap.set(an, ex);
    }
  }

  // 3. Lire et parser generatedExercises.ts
  console.log('\n📖 Lecture de generatedExercises.ts...');
  const originalContent = fs.readFileSync(GEN_EXERCISES_PATH, 'utf8');
  const exercises = parseExercisesTS(originalContent);

  if (exercises.length === 0) {
    console.error('❌ Aucun exercice parsé — le format du fichier a peut-être changé.');
    process.exit(1);
  }

  const noImage = exercises.filter(e => !e.hasImage);
  console.log(`✅ ${exercises.length} exercices parsés (${noImage.length} sans image)`);

  // 4. Trouver les correspondances
  console.log('\n🔍 Recherche des correspondances...\n');

  const JACCARD_THRESHOLD = 0.65;
  const updates = new Map(); // id → { freeEx, imageFilename, description, instructions }
  const matchLog = [];       // pour affichage

  for (const ex of noImage) {
    const norm = normalize(ex.name);

    // Correspondance exacte
    let freeEx = exactMap.get(norm);
    let matchType = 'exact';

    // Fuzzy si pas de correspondance exacte
    if (!freeEx) {
      let bestScore = 0;
      for (const { norm: n, ex: fe } of allNorm) {
        const score = jaccard(norm, n);
        if (score > bestScore) {
          bestScore = score;
          if (score >= JACCARD_THRESHOLD) freeEx = fe;
        }
      }
      if (freeEx) matchType = `fuzzy ${(bestScore * 100).toFixed(0)}%`;
    }

    if (!freeEx) continue;

    // Instructions : tableau de strings → joindre avec \n
    const instrArr = Array.isArray(freeEx.instructions)
      ? freeEx.instructions
      : (freeEx.instructions ? [freeEx.instructions] : []);
    const instructions = instrArr.join('\n');

    // Description : utiliser la description si dispo, sinon 1re instruction
    const description = freeEx.description || instrArr[0] || '';

    const imageFilename = `${freeEx.id}.jpg`;

    updates.set(ex.id, { freeEx, imageFilename, description, instructions });
    matchLog.push({ exName: ex.name, freeName: freeEx.name, matchType });
  }

  // Afficher les correspondances trouvées
  if (matchLog.length === 0) {
    console.log('ℹ️  Aucune correspondance trouvée.');
    return;
  }

  const colW = 38;
  console.log(
    `  ${'Exercice app'.padEnd(colW)} ${'→  Correspondance free-db'.padEnd(colW)} ${'Type'}`
  );
  console.log('  ' + '─'.repeat(colW * 2 + 12));
  for (const { exName, freeName, matchType } of matchLog) {
    const trunc = (s, w) => s.length > w ? s.slice(0, w - 1) + '…' : s;
    console.log(
      `  ${trunc(exName, colW).padEnd(colW)} →  ${trunc(freeName, colW).padEnd(colW)} [${matchType}]`
    );
  }
  console.log(`\n  Total : ${matchLog.length} correspondances\n`);

  if (DRY_RUN) {
    console.log('ℹ️  --dry-run actif : arrêt avant modifications.');
    return;
  }

  // 5. Télécharger les images
  console.log('⬇️  Téléchargement des images...\n');
  let dlOk = 0;
  let dlFail = 0;

  for (const [exId, upd] of updates) {
    process.stdout.write(`  ${upd.freeEx.id.padEnd(50)} `);
    const ok = await downloadImage(upd.freeEx.id, upd.imageFilename);
    if (ok) {
      dlOk++;
      process.stdout.write('✅\n');
    } else {
      dlFail++;
      process.stdout.write('⚠️  (image non trouvée — description/instructions quand même mises à jour)\n');
      // Garder image: null si le téléchargement échoue
      upd.imageFilename = null;
    }
  }

  console.log(`\n  ${dlOk} images téléchargées, ${dlFail} non trouvées`);

  // 6. Réécrire generatedExercises.ts
  console.log('\n✏️  Mise à jour de generatedExercises.ts...');

  // Trier par position décroissante pour remplacer de la fin vers le début
  const toRewrite = [...updates.keys()]
    .map(id => exercises.find(e => e.id === id))
    .filter(Boolean)
    .sort((a, b) => b.start - a.start);

  let newContent = originalContent;

  for (const ex of toRewrite) {
    const upd = updates.get(ex.id);
    const imageStr = upd.imageFilename ? `'${upd.imageFilename}'` : 'null';

    const newBlock =
      `{\n` +
      `    id: "${ex.id}",\n` +
      `    name: "${ex.name}",\n` +
      `    muscle: "${ex.muscle}",\n` +
      `    equipment: "${ex.equipment}",\n` +
      `    image: ${imageStr},\n` +
      `    description: ${toTSString(upd.description)},\n` +
      `    instructions: ${toTSString(upd.instructions)},\n` +
      `  }`;

    newContent = newContent.slice(0, ex.start) + newBlock + newContent.slice(ex.end);
  }

  fs.writeFileSync(GEN_EXERCISES_PATH, newContent, 'utf8');
  console.log('✅ generatedExercises.ts mis à jour');

  // 7. Régénérer exerciseImageMap.ts
  console.log('\n✏️  Régénération de exerciseImageMap.ts...');

  const imageFiles = fs.readdirSync(IMAGE_DIR)
    .filter(f => /\.(jpg|jpeg|png|gif)$/i.test(f))
    .sort();

  const mapContent =
    `import { ImageSourcePropType } from 'react-native';\n\n` +
    `const exerciseImageMap: Record<string, ImageSourcePropType> = {\n` +
    imageFiles
      .map(f => `  ${JSON.stringify(f)}: require("@/assets/exercise_images/${f}"),`)
      .join('\n') +
    `\n};\n\nexport default exerciseImageMap;\n`;

  fs.writeFileSync(IMAGE_MAP_PATH, mapContent, 'utf8');
  console.log(`✅ exerciseImageMap.ts régénéré (${imageFiles.length} images)`);

  // 8. Résumé
  console.log('\n' + '═'.repeat(60));
  console.log('🎉  Enrichissement terminé !');
  console.log(`    ${updates.size} exercices mis à jour`);
  console.log(`    ${dlOk} nouvelles images ajoutées`);
  console.log('\n    → Relance l\'app Expo pour voir les changements.');
  console.log('    → Les exercices wger correspondants ont maintenant');
  console.log('      des images sketch + descriptions complètes.');
  console.log('═'.repeat(60) + '\n');
}

main().catch(e => {
  console.error('\n❌ Erreur fatale :', e.message);
  if (process.env.DEBUG) console.error(e.stack);
  process.exit(1);
});
