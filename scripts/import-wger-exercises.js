/**
 * Fetches all exercises from wger with French translations,
 * matches images from the existing yuhonas dataset,
 * and writes the merged result to assets/data/generatedExercises.ts
 *
 * Run: node scripts/import-wger-exercises.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const FRENCH_LANG_ID = 12;
const ENGLISH_LANG_ID = 2;

// wger muscle name_en → yuhonas muscle key
const MUSCLE_MAP = {
  'Biceps':          'Biceps',
  'Triceps':         'Triceps',
  'Shoulders':       'Shoulders',
  'Chest':           'Chest',
  'Abs':             'Abdominals',
  'Glutes':          'Glutes',
  'Quads':           'Quadriceps',
  'Hamstrings':      'Hamstrings',
  'Calves':          'Calves',
  'Back':            'Lats',
  'Lower Back':      'Lower back',
  'Middle Back':     'Middle back',
  'Traps':           'Traps',
  'Forearms':        'Forearms',
  'Adductors':       'Adductors',
  'Abductors':       'Abductors',
  'Neck':            'Neck',
};

// wger category name → yuhonas muscle fallback (when muscles[] is empty)
const CATEGORY_FALLBACK = {
  'Abs':       'Abdominals',
  'Arms':      'Biceps',
  'Back':      'Lats',
  'Calves':    'Calves',
  'Cardio':    'Abdominals',
  'Chest':     'Chest',
  'Legs':      'Quadriceps',
  'Shoulders': 'Shoulders',
};

// wger equipment ID → yuhonas equipment key
const EQUIPMENT_MAP = {
  1:  'Barbell',
  2:  'E-z curl bar',
  3:  'Dumbbell',
  4:  'Other',
  5:  'Exercise ball',
  6:  'Body only',   // Pull-up bar → treat as bodyweight
  7:  'Body only',
  8:  'Other',       // Bench (accessory, not the main equipment)
  9:  'Other',
  10: 'Kettlebells',
  11: 'Bands',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'StrongApp/1.0 data-import' } }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`JSON parse failed for ${url}: ${e.message}`)); }
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function fetchAllPages(baseUrl) {
  const results = [];
  let url = baseUrl;
  let page = 1;
  while (url) {
    process.stdout.write(`  page ${page}...`);
    const data = await fetchJSON(url);
    results.push(...data.results);
    process.stdout.write(` (${data.results.length} items)\n`);
    url = data.next;
    page++;
    if (url) await new Promise(r => setTimeout(r, 300));
  }
  return results;
}

/** Strip HTML tags and convert list items to numbered text lines */
function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<ol[^>]*>/gi, '')
    .replace(/<\/ol>/gi, '')
    .replace(/<ul[^>]*>/gi, '')
    .replace(/<\/ul>/gi, '')
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, c) => c.replace(/<[^>]+>/g, '').trim() + '\n')
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, c) => c.replace(/<[^>]+>/g, '').trim() + '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Normalize name for fuzzy matching */
function norm(name) {
  return name.toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== wger exercise import ===\n');

  // 1. Fetch all wger exercises
  console.log('Fetching exercises from wger API:');
  const wgerExercises = await fetchAllPages(
    'https://wger.de/api/v2/exerciseinfo/?format=json&limit=100&ordering=id'
  );
  console.log(`→ ${wgerExercises.length} total exercises from wger\n`);

  // 2. Load existing yuhonas exercises for image matching
  console.log('Loading existing yuhonas exercise data...');
  const yuhonasPath = path.join(__dirname, '../assets/data/generatedExercises.ts');
  const yuhonasRaw = fs.readFileSync(yuhonasPath, 'utf-8');

  // Extract each exercise block: id, name, muscle, equipment, image, description, instructions
  const yuhonasExercises = [];
  const blockRegex = /\{\s*id:\s*"([^"]+)",\s*name:\s*"([^"]+)",[^}]*?image:\s*'([^']*)'[^}]*?\}/gs;
  for (const m of yuhonasRaw.matchAll(blockRegex)) {
    yuhonasExercises.push({ id: m[1], name: m[2], image: m[3] });
  }
  console.log(`→ ${yuhonasExercises.length} yuhonas exercises loaded`);

  // Build lookup: normalized English name → { id, image }
  const imageByName = new Map();
  for (const ex of yuhonasExercises) {
    imageByName.set(norm(ex.name), { id: ex.id, image: ex.image });
  }
  console.log(`→ Image map ready (${imageByName.size} entries)\n`);

  // 3. Process wger exercises
  console.log('Processing wger exercises...');
  const output = [];
  let noFrench = 0;
  let withImage = 0;

  for (const ex of wgerExercises) {
    const frTrans = ex.translations?.find(t => t.language === FRENCH_LANG_ID);
    const enTrans = ex.translations?.find(t => t.language === ENGLISH_LANG_ID);

    if (!frTrans && !enTrans) continue; // skip exercises with no usable translation
    const trans = frTrans || enTrans;
    if (!trans.name?.trim()) continue;
    if (!frTrans) noFrench++;

    // Muscle: use primary muscle name_en mapped to yuhonas key, fall back to category
    const primaryMuscle = ex.muscles?.[0];
    const muscle = primaryMuscle
      ? (MUSCLE_MAP[primaryMuscle.name_en] ?? CATEGORY_FALLBACK[ex.category?.name] ?? 'Other')
      : (CATEGORY_FALLBACK[ex.category?.name] ?? 'Other');

    // Equipment: first equipment in list
    const equip = ex.equipment?.[0];
    const equipment = equip ? (EQUIPMENT_MAP[equip.id] ?? 'Other') : 'Body only';

    // English name for image matching
    const enName = enTrans?.name?.trim() || trans.name;
    const normalizedEn = norm(enName);

    // Try exact match, then partial match
    let matchedImage = null;
    let matchedId = null;

    if (imageByName.has(normalizedEn)) {
      const m = imageByName.get(normalizedEn);
      matchedImage = m.image;
      matchedId = m.id;
    } else {
      for (const [key, val] of imageByName) {
        if (normalizedEn.length > 4 && key.includes(normalizedEn)) {
          matchedImage = val.image;
          matchedId = val.id;
          break;
        }
      }
    }

    if (matchedImage) withImage++;

    const rawInstructions = stripHtml(trans.description);
    const descLines = rawInstructions.split('\n').filter(Boolean);
    const description = descLines[0] || '';
    const instructions = descLines.join('\n');

    output.push({
      id:           matchedId ?? `wger_${ex.id}`,
      name:         trans.name.trim(),
      muscle,
      equipment,
      image:        matchedImage ? `'${matchedImage}'` : 'null',
      description,
      instructions,
    });
  }

  console.log(`→ ${output.length} exercises processed`);
  console.log(`→ ${noFrench} fell back to English (no French translation)`);
  console.log(`→ ${withImage} matched with yuhonas image\n`);

  // 4. Add yuhonas exercises NOT already covered by wger (to keep the rest with images)
  console.log('Adding yuhonas-only exercises...');
  const usedIds = new Set(output.map(e => e.id));
  const usedNormNames = new Set(output.map(e => norm(e.name)));
  let yuhonasAdded = 0;

  // Parse yuhonas full data
  const fullBlockRegex = /\{\s*id:\s*"([^"]+)",\s*name:\s*"([^"]+)",\s*muscle:\s*"([^"]+)",\s*equipment:\s*"([^"]+)",\s*image:\s*'([^']*)'(?:,\s*description:\s*"((?:[^"\\]|\\[\s\S])*)")?(?:,\s*instructions:\s*"((?:[^"\\]|\\[\s\S])*)")?\s*\}/gs;
  for (const m of yuhonasRaw.matchAll(fullBlockRegex)) {
    const [, id, name, muscle, equipment, image, description = '', instructions = ''] = m;
    if (usedIds.has(id) || usedNormNames.has(norm(name))) continue;
    output.push({
      id, name, muscle, equipment,
      image: `'${image}'`,
      description,
      instructions,
    });
    yuhonasAdded++;
  }
  console.log(`→ ${yuhonasAdded} additional exercises from yuhonas\n`);

  // 5. Deduplicate by id
  const seen = new Map();
  for (const ex of output) {
    if (!seen.has(ex.id)) seen.set(ex.id, ex);
  }
  const final = Array.from(seen.values());
  console.log(`→ Final count after dedup: ${final.length} exercises\n`);

  // 6. Write TypeScript file
  const rows = final.map(ex => `  {
    id: ${JSON.stringify(ex.id)},
    name: ${JSON.stringify(ex.name)},
    muscle: ${JSON.stringify(ex.muscle)},
    equipment: ${JSON.stringify(ex.equipment)},
    image: ${ex.image},
    description: ${JSON.stringify(ex.description)},
    instructions: ${JSON.stringify(ex.instructions)},
  }`).join(',\n');

  const output_ts = `\nexport const initialExercises = [\n${rows}\n];\n`;

  fs.writeFileSync(yuhonasPath, output_ts, 'utf-8');
  console.log(`✓ Written to assets/data/generatedExercises.ts (${final.length} exercises)`);

  // 7. Report muscle distribution
  const muscleCounts = {};
  for (const ex of final) muscleCounts[ex.muscle] = (muscleCounts[ex.muscle] ?? 0) + 1;
  console.log('\nMuscle distribution:');
  Object.entries(muscleCounts).sort((a, b) => b[1] - a[1]).forEach(([m, c]) =>
    console.log(`  ${m.padEnd(18)} ${c}`)
  );
}

main().catch(err => { console.error('\n✗ Error:', err.message); process.exit(1); });
