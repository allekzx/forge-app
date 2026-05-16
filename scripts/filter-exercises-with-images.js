#!/usr/bin/env node
/**
 * scripts/filter-exercises-with-images.js
 *
 * Garde uniquement les exercices qui ont une image sketch (style Strong).
 * Supprime les 656 exercices wger sans illustration.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const GEN_EXERCISES_PATH = path.join(ROOT, 'assets/data/generatedExercises.ts');

// ── Parser (identique à enrich-exercises.js) ──────────────────────────────────

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
    exercises.push({
      id:        m[1],
      name:      m[2],
      muscle:    m[3],
      equipment: m[4],
      imageRaw:  m[5],
      hasImage:  m[5] !== 'null',
      descRaw:   m[6],
      instrRaw:  m[7],
      fullMatch: m[0],
      start:     m.index,
      end:       m.index + m[0].length,
    });
  }
  return exercises;
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  console.log('\n🖼️  Filtrage — exercices avec image uniquement\n');

  const content = fs.readFileSync(GEN_EXERCISES_PATH, 'utf8');
  const exercises = parseExercisesTS(content);

  const withImg = exercises.filter(e => e.hasImage);
  const noImg   = exercises.filter(e => !e.hasImage);

  console.log(`  Total parsé   : ${exercises.length}`);
  console.log(`  Avec image    : ${withImg.length}  ← à garder`);
  console.log(`  Sans image    : ${noImg.length}   ← à supprimer\n`);

  // Reconstruire le fichier TS avec seulement les exercices ayant une image
  const blocks = withImg.map(e => `  ${e.fullMatch}`).join(',\n');
  const newContent =
    `\nexport const initialExercises = [\n` +
    blocks +
    `,\n];\n`;

  fs.writeFileSync(GEN_EXERCISES_PATH, newContent, 'utf8');

  console.log(`✅ generatedExercises.ts réécrit avec ${withImg.length} exercices`);
  console.log(`   ${noImg.length} exercices sans image supprimés`);
  console.log('\n   → Pense à relancer l\'app (le re-seed se déclenche automatiquement).\n');
}

main();
