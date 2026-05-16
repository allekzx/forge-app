#!/usr/bin/env node
/**
 * scripts/download-exercisedb-images.js
 *
 * Télécharge les images statiques style Strong depuis ExerciseDB.
 * Quota free tier : 10 req/mois. Priorise les exercices des templates.
 * Reprend là où il s'est arrêté grâce au fichier de progression.
 *
 * Usage :
 *   node scripts/download-exercisedb-images.js --key VOTRE_CLÉ
 *   node scripts/download-exercisedb-images.js --key VOTRE_CLÉ --dry-run
 *
 * Clé API : compte gratuit sur rapidapi.com → ExerciseDB Basic (10 req/mois)
 */

const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');

// Clé API : argument --key ou variable d'environnement RAPIDAPI_KEY
const keyArg = process.argv.find((a, i) => process.argv[i - 1] === '--key');
const RAPID_API_KEY = keyArg || process.env.RAPIDAPI_KEY || '';
const RESOLUTION    = 180;   // 180 | 360 | 720 | 1080

const ROOT           = path.join(__dirname, '..');
const GEN_PATH       = path.join(ROOT, 'assets/data/generatedExercises.ts');
const IMAGE_MAP_PATH = path.join(ROOT, 'assets/data/exerciseImageMap.ts');
const IMAGE_DIR      = path.join(ROOT, 'assets/exercise_images');

const DRY_RUN           = process.argv.includes('--dry-run');
const JACCARD_THRESHOLD = 0.60;
const API_HOST          = 'exercisedb.p.rapidapi.com';
const PROGRESS_PATH     = path.join(__dirname, '.exercisedb-progress.json');

// Exercices prioritaires — extraits des templates Push/Pull/Legs/Upper/Lower
const PRIORITY_NAMES = [
  'Cable Chest Press', 'Incline Bench Press', 'Chest Fly', 'Shoulder Press',
  'Lateral Raise', 'Triceps Dip', 'Lat Pulldown', 'Seated Row', 'Cable Row',
  'Reverse Fly', 'Preacher Curl', 'Incline Curl', 'Kneeling Pulldown',
  'Squat', 'Leg Press', 'Bulgarian Split Squat', 'Stiff-Legged Deadlift',
  'Ab Crunch Machine', 'Thigh Abductor', 'Thigh Adductor',
  'Bench Press', 'Chin-Up', 'Dumbbell Row', 'Hammer Curl',
  'Triceps Extension', 'Deadlift', 'Walking Lunge', 'Plank',
  'Barbell Row', 'Pull-Up', 'Face Pull', 'Arnold Press',
];

// ── Utilitaires ───────────────────────────────────────────────────────────────

function normalize(name) {
  return name.toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function jaccard(a, b) {
  const wa = new Set(a.split(' ').filter(Boolean));
  const wb = new Set(b.split(' ').filter(Boolean));
  if (!wa.size || !wb.size) return 0;
  const inter = [...wa].filter(w => wb.has(w)).length;
  return inter / new Set([...wa, ...wb]).size;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Appel API RapidAPI ────────────────────────────────────────────────────────

function apiGet(urlPath) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: API_HOST,
      path: urlPath,
      method: 'GET',
      headers: {
        'X-RapidAPI-Key':  RAPID_API_KEY,
        'X-RapidAPI-Host': API_HOST,
      },
    };
    const req = https.request(options, (res) => {
      if (res.statusCode === 401 || res.statusCode === 403)
        return reject(new Error('Clé API invalide. Vérifie ta clé RapidAPI.'));
      if (res.statusCode === 429)
        return reject(new Error('Quota dépassé (10 req/mois). Réessaie le mois prochain.'));

      // Si l'API redirige vers une image CDN, on retourne le Location
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        return resolve({ redirect: res.headers.location });
      }

      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => {
        const ct = res.headers['content-type'] || '';
        if (ct.includes('image/')) {
          // L'image est retournée directement comme binaire
          resolve({ binary: Buffer.from(data, 'binary'), contentType: ct });
        } else {
          try { resolve({ json: JSON.parse(data) }); }
          catch { resolve({ text: data }); }
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// ── Téléchargement image depuis URL quelconque ────────────────────────────────

function downloadFromUrl(imageUrl, destPath) {
  return new Promise((resolve) => {
    if (fs.existsSync(destPath)) { resolve(true); return; }

    const parsed = new URL(imageUrl);
    const lib    = parsed.protocol === 'https:' ? https : http;
    const options = {
      hostname: parsed.hostname,
      path:     parsed.pathname + parsed.search,
      method:   'GET',
      headers:  { 'User-Agent': 'Mozilla/5.0' },
    };

    const file    = fs.createWriteStream(destPath);
    const cleanup = () => { try { fs.unlinkSync(destPath); } catch {} };

    lib.request(options, (res) => {
      // Suivre les redirections
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        file.destroy();
        cleanup();
        downloadFromUrl(res.headers.location, destPath).then(resolve);
        return;
      }
      if (res.statusCode !== 200) { file.destroy(); cleanup(); resolve(false); return; }
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve(true)));
      file.on('error', () => { cleanup(); resolve(false); });
    }).on('error', () => { cleanup(); resolve(false); }).end();
  });
}

// ── Parser generatedExercises.ts ──────────────────────────────────────────────

function parseExercisesTS(content) {
  const exercises = [];
  const pat = new RegExp([
    /\{\s*\r?\n/.source,
    /\s+id:\s*"([^"]+)",\r?\n/.source,
    /\s+name:\s*"([^"]+)",\r?\n/.source,
    /\s+muscle:\s*"([^"]+)",\r?\n/.source,
    /\s+equipment:\s*"([^"]+)",\r?\n/.source,
    /\s+image:\s*(null|'[^']*'|"[^"]*"),\r?\n/.source,
    /\s+description:\s*(null|"(?:[^"\\]|\\.)*"),\r?\n/.source,
    /\s+instructions:\s*(null|"(?:[^"\\]|\\.)*"),\r?\n/.source,
    /\s+\}/.source,
  ].join(''), 'g');

  let m;
  while ((m = pat.exec(content)) !== null) {
    exercises.push({
      id: m[1], name: m[2], muscle: m[3], equipment: m[4],
      imageRaw: m[5], descRaw: m[6], instrRaw: m[7],
      fullMatch: m[0], start: m.index, end: m.index + m[0].length,
    });
  }
  return exercises;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🏋️  Téléchargement images ExerciseDB (style Strong)\n');

  if (!RAPID_API_KEY) {
    console.error('❌ Clé API manquante !');
    console.error('   Usage : node scripts/download-exercisedb-images.js --key VOTRE_CLÉ\n');
    process.exit(1);
  }

  // Charger la progression (quels IDs ont déjà été téléchargés)
  const progress = fs.existsSync(PROGRESS_PATH)
    ? JSON.parse(fs.readFileSync(PROGRESS_PATH, 'utf8'))
    : { downloaded: [], failed: [], lastRun: null };
  const alreadyDone = new Set(progress.downloaded);

  // ── Étape 1 : récupérer tous les exercices ExerciseDB (1 appel API) ─────────
  console.log('📡 Appel 1/2 — listExercises (récupère tous les IDs et noms)...');
  let exdbList;
  try {
    const res = await apiGet('/exercises?limit=1400&offset=0');
    if (!res.json) throw new Error('Réponse inattendue : ' + JSON.stringify(res).slice(0, 200));
    exdbList = res.json;
  } catch (e) {
    console.error('❌', e.message);
    process.exit(1);
  }
  console.log(`✅ ${exdbList.length} exercices récupérés\n`);

  // ── Étape 2 : tester getExerciseImage pour déduire le pattern CDN (1 appel) ─
  console.log('📡 Appel 2/2 — getExerciseImage (test avec ID "0001")...');
  let imageUrlPattern = null;
  let useDirectApi    = false;
  let imageExtension  = 'jpg';

  try {
    const testRes = await apiGet(`/image?exerciseId=0001&resolution=${RESOLUTION}`);

    if (testRes.redirect) {
      // L'API redirige vers un CDN → on déduit le pattern
      const cdnUrl = testRes.redirect;
      console.log(`  Redirect CDN : ${cdnUrl}`);
      // Remplacer "0001" et la résolution dans l'URL pour créer un template
      imageUrlPattern = cdnUrl
        .replace('0001', '{ID}')
        .replace(`/${RESOLUTION}`, `/${RESOLUTION}`);
      imageExtension = cdnUrl.split('.').pop()?.split('?')[0] || 'jpg';
      console.log(`  Pattern URL  : ${imageUrlPattern}`);

    } else if (testRes.binary) {
      // L'image est retournée directement via l'API
      console.log('  Mode : image binaire directe via API');
      useDirectApi = true;
      const ct = testRes.contentType || '';
      if (ct.includes('gif')) imageExtension = 'gif';
      else if (ct.includes('png')) imageExtension = 'png';

    } else if (testRes.json) {
      // Réponse JSON avec une URL dans un champ
      const url = testRes.json?.url || testRes.json?.imageUrl || testRes.json?.gifUrl || '';
      if (url) {
        imageUrlPattern = url.replace('0001', '{ID}');
        imageExtension = url.split('.').pop()?.split('?')[0] || 'jpg';
        console.log(`  URL champ JSON : ${url}`);
      } else {
        console.log('  Réponse JSON inattendue :', JSON.stringify(testRes.json).slice(0, 200));
      }
    }
  } catch (e) {
    console.error('⚠️  Impossible de tester getExerciseImage :', e.message);
  }

  console.log();

  // ── Lire nos exercices + construire table de correspondance ─────────────────
  const content   = fs.readFileSync(GEN_PATH, 'utf8');
  const exercises = parseExercisesTS(content);

  const exactMap = new Map();
  const allNorm  = [];
  for (const ex of exdbList) {
    const norm = normalize(ex.name);
    if (!exactMap.has(norm)) exactMap.set(norm, ex);
    allNorm.push({ norm, ex });
  }

  // Associer chaque exercice app → exercice ExerciseDB
  const appToExdb = new Map();
  for (const ex of exercises) {
    if (ex.imageRaw !== 'null') continue; // déjà une image
    const norm = normalize(ex.name);
    let match = exactMap.get(norm);
    if (!match) {
      let best = 0;
      for (const { norm: n, ex: fe } of allNorm) {
        const s = jaccard(norm, n);
        if (s > best && s >= JACCARD_THRESHOLD) { best = s; match = fe; }
      }
    }
    if (match) appToExdb.set(ex.id, match);
  }

  // Trier : priorité d'abord, puis alphabétique
  const isPriority = (appId) => {
    const ex = exercises.find(e => e.id === appId);
    if (!ex) return false;
    const norm = normalize(ex.name);
    return PRIORITY_NAMES.some(p => norm.includes(normalize(p)));
  };

  const toDownload = [...appToExdb.keys()]
    .filter(id => !alreadyDone.has(id))
    .sort((a, b) => {
      const pa = isPriority(a) ? 0 : 1;
      const pb = isPriority(b) ? 0 : 1;
      return pa - pb;
    });

  const priorityCount = toDownload.filter(isPriority).length;
  console.log(`📖 ${exercises.length} exercices dans l'app`);
  console.log(`🔍 ${appToExdb.size} correspondances ExerciseDB trouvées`);
  console.log(`   ${alreadyDone.size} déjà téléchargées, ${toDownload.length} restantes`);
  console.log(`   dont ${priorityCount} prioritaires (templates)\n`);

  if (DRY_RUN) {
    console.log('Prochains téléchargements (ordre de priorité) :');
    toDownload.slice(0, 15).forEach(id => {
      const ex = exercises.find(e => e.id === id);
      const match = appToExdb.get(id);
      console.log(`  ${isPriority(id) ? '★' : ' '} ${ex?.name} → [${match?.id}] ${match?.name}`);
    });
    console.log('\nℹ️  --dry-run : arrêt ici.');
    return;
  }

  // ── Télécharger via API (quota : 8 images/mois après les 2 appels init) ───
  const MAX_DOWNLOADS = 8;
  const batch = toDownload.slice(0, MAX_DOWNLOADS);

  console.log(`⬇️  Téléchargement de ${batch.length} images (quota mensuel)...\n`);
  let dlOk = 0, dlFail = 0;
  const updates = new Map();

  for (const appId of batch) {
    const match = appToExdb.get(appId);
    const exId  = match.id.toString().padStart(4, '0');
    const filename = `exdb_${exId}.jpg`;
    const destPath = path.join(IMAGE_DIR, filename);
    const star = isPriority(appId) ? '★ ' : '  ';

    process.stdout.write(`  ${star}[${exId}] ${match.name.slice(0, 42).padEnd(42)} `);

    let ok = false;
    if (fs.existsSync(destPath)) {
      ok = true;
    } else {
      try {
        const res = await apiGet(`/image?exerciseId=${exId}&resolution=${RESOLUTION}`);
        if (res.binary && res.binary.length > 1000) {
          fs.writeFileSync(destPath, res.binary);
          ok = true;
        }
      } catch { ok = false; }
      await sleep(300);
    }

    if (ok) {
      dlOk++;
      updates.set(appId, filename);
      progress.downloaded.push(appId);
      process.stdout.write('✅\n');
    } else {
      dlFail++;
      progress.failed.push(appId);
      process.stdout.write('⚠️\n');
    }
  }

  progress.lastRun = new Date().toISOString();
  fs.writeFileSync(PROGRESS_PATH, JSON.stringify(progress, null, 2));

  console.log(`\n  ${dlOk} images téléchargées, ${dlFail} échecs`);
  console.log(`  Progression : ${progress.downloaded.length}/${appToExdb.size} au total`);
  console.log(`  Restantes   : ${toDownload.length - batch.length} (prochain run dans ~1 mois)\n`);

  if (dlOk === 0) return;

  console.log(`\n  ${dlOk} images téléchargées, ${dlFail} échecs\n`);

  if (dlOk === 0) {
    console.log('⚠️  Aucune image téléchargée.');
    console.log('   Le pattern CDN n\'a pas pu être détecté automatiquement.');
    console.log('   Envoie-moi la réponse exacte de getExerciseImage (ID: 0001) pour déboguer.\n');
    return;
  }

  // ── Mettre à jour generatedExercises.ts ───────────────────────────────────
  console.log('✏️  Mise à jour de generatedExercises.ts...');
  const toRewrite = [...updates.entries()]
    .map(([id, upd]) => ({ ex: exercises.find(e => e.id === id), upd }))
    .filter(x => x.ex && x.upd.filename)
    .sort((a, b) => b.ex.start - a.ex.start);

  let newContent = content;
  for (const { ex, upd } of toRewrite) {
    const block =
      `{\n    id: "${ex.id}",\n    name: "${ex.name}",\n` +
      `    muscle: "${ex.muscle}",\n    equipment: "${ex.equipment}",\n` +
      `    image: '${upd.filename}',\n` +
      `    description: ${ex.descRaw},\n    instructions: ${ex.instrRaw},\n  }`;
    newContent = newContent.slice(0, ex.start) + block + newContent.slice(ex.end);
  }
  fs.writeFileSync(GEN_PATH, newContent, 'utf8');
  console.log('✅ generatedExercises.ts mis à jour');

  // ── Régénérer exerciseImageMap.ts ─────────────────────────────────────────
  console.log('✏️  Régénération de exerciseImageMap.ts...');
  const imageFiles = fs.readdirSync(IMAGE_DIR)
    .filter(f => /\.(jpg|jpeg|png|gif)$/i.test(f)).sort();
  const mapContent =
    `import { ImageSourcePropType } from 'react-native';\n\n` +
    `const exerciseImageMap: Record<string, ImageSourcePropType> = {\n` +
    imageFiles.map(f => `  ${JSON.stringify(f)}: require("@/assets/exercise_images/${f}"),`).join('\n') +
    `\n};\n\nexport default exerciseImageMap;\n`;
  fs.writeFileSync(IMAGE_MAP_PATH, mapContent, 'utf8');
  console.log(`✅ exerciseImageMap.ts régénéré (${imageFiles.length} images)`);

  // ── Réactiver les images dans exercises.tsx ───────────────────────────────
  const exPath    = path.join(ROOT, 'app/(tabs)/exercises.tsx');
  let exContent   = fs.readFileSync(exPath, 'utf8');
  if (!exContent.includes('exerciseImageMap')) {
    exContent = `import exerciseImageMap from '@/assets/data/exerciseImageMap';\n` + exContent;
    fs.writeFileSync(exPath, exContent, 'utf8');
    console.log('✅ Import exerciseImageMap réactivé dans exercises.tsx');
  }

  console.log('\n' + '═'.repeat(60));
  console.log('🎉  Terminé !');
  console.log(`    ${dlOk} images style Strong téléchargées`);
  console.log(`    Résolution : ${RESOLUTION}px`);
  console.log('\n    → Relance l\'app pour voir les images.');
  console.log('    → Les exercices sans correspondance gardent le badge coloré.');
  console.log('═'.repeat(60) + '\n');
}

main().catch(e => {
  console.error('\n❌ Erreur :', e.message);
  process.exit(1);
});
