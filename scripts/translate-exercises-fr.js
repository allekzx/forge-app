#!/usr/bin/env node
/**
 * scripts/translate-exercises-fr.js
 *
 * Traduit les descriptions et instructions des exercices vers le français
 * via l'API Google Translate (gratuit, sans clé API).
 *
 * Usage :
 *   node scripts/translate-exercises-fr.js
 *   node scripts/translate-exercises-fr.js --dry-run   (test sur 5 exercices)
 *   node scripts/translate-exercises-fr.js --resume    (reprend là où ça s'est arrêté)
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const GEN_EXERCISES_PATH = path.join(ROOT, 'assets/data/generatedExercises.ts');
const PROGRESS_PATH = path.join(__dirname, '.translate-progress.json');

const DRY_RUN = process.argv.includes('--dry-run');
const RESUME  = process.argv.includes('--resume');

// ── Parser (même logique que les autres scripts) ──────────────────────────────

function parseExercisesTS(content) {
  const exercises = [];
  const pat = new RegExp(
    [
      /\{\s*\r?\n/.source,
      /\s+id:\s*"([^"]+)",\r?\n/.source,
      /\s+name:\s*"([^"]+)",\r?\n/.source,
      /\s+muscle:\s*"([^"]+)",\r?\n/.source,
      /\s+equipment:\s*"([^"]+)",\r?\n/.source,
      /\s+image:\s*(null|'[^']*'|"[^"]*"),\r?\n/.source,
      /\s+description:\s*(null|"(?:[^"\\]|\\.)*"),\r?\n/.source,
      /\s+instructions:\s*(null|"(?:[^"\\]|\\.)*"),\r?\n/.source,
      /\s+\}/.source,
    ].join(''),
    'g'
  );

  let m;
  while ((m = pat.exec(content)) !== null) {
    // Extraire la valeur réelle de la string TS
    const parseVal = (raw) => {
      if (!raw || raw === 'null') return '';
      const inner = raw.slice(1, -1); // retire les guillemets extérieurs
      return inner
        .replace(/\\n/g, '\n')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');
    };

    exercises.push({
      id:        m[1],
      name:      m[2],
      muscle:    m[3],
      equipment: m[4],
      imageRaw:  m[5],
      descRaw:   m[6],
      instrRaw:  m[7],
      desc:      parseVal(m[6]),
      instr:     parseVal(m[7]),
      fullMatch: m[0],
      start:     m.index,
      end:       m.index + m[0].length,
    });
  }
  return exercises;
}

// ── Traduction Google Translate (sans clé) ────────────────────────────────────

function translateText(text) {
  return new Promise((resolve) => {
    if (!text || !text.trim()) { resolve(''); return; }

    // Tronque si trop long (Google Translate limite ~5000 chars)
    const truncated = text.length > 4800 ? text.slice(0, 4800) : text;
    const encoded = encodeURIComponent(truncated);
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=fr&dt=t&q=${encoded}`;

    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          // Format de réponse : [[["texte traduit", "texte original", ...], ...], ...]
          const translated = parsed[0]
            .map(chunk => (chunk[0] || ''))
            .join('');
          resolve(translated.trim());
        } catch {
          resolve(''); // En cas d'erreur, on garde vide
        }
      });
    }).on('error', () => resolve(''));
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function toTSString(value) {
  if (!value) return '""';
  return `"${String(value)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, '\\n')}"`;
}

function isLikelyAlreadyFrench(text) {
  if (!text || !text.trim()) return true;
  // Mots sans ambiguïté français — nécessite 2 correspondances minimum
  // Utilise \b pour éviter les faux positifs ("then" contient "en", etc.)
  const indicators = [
    /\bvotre\b/, /\bvos\b/, /\bavec\b/, /\bdans\b/, /\bpour\b/,
    /\bvous\b/, /\bune\b/, /\bsont\b/, /\bcette\b/, /\bces\b/,
    /\bsur\b/, /\bpar\b/, /\bque\b/, /\bqui\b/, /\bou\b/,
    /\bau\b/, /\baux\b/, /\bdu\b/, /\bdes\b/,
  ];
  const lower = text.toLowerCase();
  const count = indicators.filter(r => r.test(lower)).length;
  return count >= 2;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🇫🇷  Traduction des exercices vers le français\n');
  if (DRY_RUN) console.log('  ⚠️  Mode --dry-run : test sur 5 exercices, aucun fichier modifié\n');

  const content = fs.readFileSync(GEN_EXERCISES_PATH, 'utf8');
  const exercises = parseExercisesTS(content);
  console.log(`✅ ${exercises.length} exercices parsés`);

  // Charger la progression sauvegardée (pour --resume)
  let saved = {};
  if (RESUME && fs.existsSync(PROGRESS_PATH)) {
    saved = JSON.parse(fs.readFileSync(PROGRESS_PATH, 'utf8'));
    console.log(`♻️  Reprise : ${Object.keys(saved).length} exercices déjà traduits\n`);
  }

  // Exercices qui ont quelque chose à traduire
  const toTranslate = exercises.filter(e =>
    (e.desc && e.desc.trim() && !isLikelyAlreadyFrench(e.desc)) ||
    (e.instr && e.instr.trim() && !isLikelyAlreadyFrench(e.instr))
  );

  console.log(`🔤 ${toTranslate.length} exercices à traduire (${exercises.length - toTranslate.length} vides ou déjà en français)\n`);

  const target = DRY_RUN ? toTranslate.slice(0, 5) : toTranslate;
  const translations = { ...saved };
  let done = 0;
  let skipped = 0;

  for (const ex of target) {
    // Déjà traduit ?
    if (translations[ex.id]) {
      skipped++;
      continue;
    }

    process.stdout.write(`  [${done + skipped + 1}/${target.length}] ${ex.name.padEnd(45)} `);

    let descFr = '';
    let instrFr = '';

    if (ex.desc && ex.desc.trim() && !isLikelyAlreadyFrench(ex.desc)) {
      descFr = await translateText(ex.desc);
      await sleep(150); // évite le rate limiting
    } else {
      descFr = ex.desc;
    }

    if (ex.instr && ex.instr.trim() && !isLikelyAlreadyFrench(ex.instr)) {
      instrFr = await translateText(ex.instr);
      await sleep(150);
    } else {
      instrFr = ex.instr;
    }

    translations[ex.id] = { desc: descFr, instr: instrFr };
    done++;
    process.stdout.write('✅\n');

    // Sauvegarde de la progression toutes les 50 traductions
    if (done % 50 === 0 && !DRY_RUN) {
      fs.writeFileSync(PROGRESS_PATH, JSON.stringify(translations, null, 2));
      console.log(`  💾 Progression sauvegardée (${done} traduits)`);
    }
  }

  console.log(`\n✅ ${done} traduits, ${skipped} déjà faits\n`);

  if (DRY_RUN) {
    console.log('── Aperçu des traductions ──────────────────────────────\n');
    for (const [id, t] of Object.entries(translations).slice(0, 5)) {
      const ex = exercises.find(e => e.id === id);
      if (!ex) continue;
      console.log(`  ${ex.name}`);
      if (t.desc) console.log(`  DESC FR: ${t.desc.slice(0, 100)}...`);
      if (t.instr) console.log(`  INSTR FR: ${t.instr.slice(0, 100)}...`);
      console.log();
    }
    console.log('ℹ️  --dry-run actif : arrêt avant modification des fichiers.');
    return;
  }

  if (done === 0 && skipped === target.length) {
    console.log('ℹ️  Tout est déjà traduit, aucune modification nécessaire.');
    // Nettoyage du fichier de progression si tout est fait
    if (fs.existsSync(PROGRESS_PATH)) fs.unlinkSync(PROGRESS_PATH);
    return;
  }

  // ── Réécrire generatedExercises.ts ────────────────────────────────────────
  console.log('✏️  Mise à jour de generatedExercises.ts...');

  // Trier par position décroissante (remplacer de la fin vers le début)
  const toRewrite = exercises
    .filter(e => translations[e.id])
    .sort((a, b) => b.start - a.start);

  let newContent = content;

  for (const ex of toRewrite) {
    const t = translations[ex.id];
    const newBlock =
      `{\n` +
      `    id: "${ex.id}",\n` +
      `    name: "${ex.name}",\n` +
      `    muscle: "${ex.muscle}",\n` +
      `    equipment: "${ex.equipment}",\n` +
      `    image: ${ex.imageRaw},\n` +
      `    description: ${toTSString(t.desc)},\n` +
      `    instructions: ${toTSString(t.instr)},\n` +
      `  }`;

    newContent = newContent.slice(0, ex.start) + newBlock + newContent.slice(ex.end);
  }

  fs.writeFileSync(GEN_EXERCISES_PATH, newContent, 'utf8');
  console.log('✅ generatedExercises.ts mis à jour');

  // Sauvegarder la progression finale
  fs.writeFileSync(PROGRESS_PATH, JSON.stringify(translations, null, 2));

  // Nettoyage si tout est terminé
  const remaining = toTranslate.length - Object.keys(translations).length;
  if (remaining <= 0) {
    fs.unlinkSync(PROGRESS_PATH);
    console.log('🗑️  Fichier de progression supprimé (traduction complète)');
  }

  console.log('\n' + '═'.repeat(60));
  console.log('🎉  Traduction terminée !');
  console.log(`    ${done} exercices traduits en français`);
  console.log('\n    → Relance l\'app pour voir les descriptions en français.');
  console.log('    → Si ça s\'est arrêté, relance avec --resume pour continuer.');
  console.log('═'.repeat(60) + '\n');
}

main().catch(e => {
  console.error('\n❌ Erreur :', e.message);
  process.exit(1);
});
