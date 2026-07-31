/**
 * Tests de scripts/consolidate-duplicate-exercises.js — la fusion des
 * doublons legacy/nouveau doit rester à très haute confiance (score >= 0.9,
 * même muscle, même équipement) après qu'un seuil plus bas a produit de
 * vrais faux positifs sur le catalogue réel (ex: "Sit-Up" <-> "Decline
 * Sit-up", "Dumbbell Bicep Curl" <-> "Dumbbell Seated Bicep Curl" —
 * des exercices différents que le score textuel seul ne distingue pas).
 *
 * Run: node --test scripts/test/consolidate-duplicate-exercises.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { findSafeDuplicatePairs } = require('../consolidate-duplicate-exercises');

function ex(id, name, muscle, equipment) {
  return { id, name, muscle, equipment };
}

test('findSafeDuplicatePairs: fusionne un simple réordonnancement de mots (même muscle/équipement)', () => {
  const legacy = [ex('Decline_Bench_Press_Barbell', 'Decline Bench Press Barbell', 'Chest', 'Barbell')];
  const news = [ex('hgd_0033', 'Barbell Decline Bench Press', 'Chest', 'Barbell')];
  const pairs = findSafeDuplicatePairs(legacy, news);
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].legacyId, 'Decline_Bench_Press_Barbell');
  assert.equal(pairs[0].newId, 'hgd_0033');
  assert.equal(pairs[0].score, 1);
});

test('findSafeDuplicatePairs: NE fusionne PAS deux exercices avec un équipement différent (régression "Bench Press" vs "Band Bench Press")', () => {
  const legacy = [ex('Bench_Press', 'Bench Press', 'Chest', 'Barbell')];
  const news = [ex('hgd_0001', 'Band Bench Press', 'Chest', 'Bands')];
  assert.deepEqual(findSafeDuplicatePairs(legacy, news), []);
});

test('findSafeDuplicatePairs: NE fusionne PAS deux exercices avec un muscle différent', () => {
  const legacy = [ex('Squat', 'Squat', 'Quadriceps', 'Barbell')];
  const news = [ex('hgd_0001', 'Squat', 'Glutes', 'Barbell')];
  assert.deepEqual(findSafeDuplicatePairs(legacy, news), []);
});

test('findSafeDuplicatePairs: NE fusionne PAS en dessous du seuil (mots significatifs en plus, ex. "Decline")', () => {
  // Reproduit un vrai faux positif observé sur le catalogue : "Sit-Up" vs
  // "Decline Sit-up" partagent 1 mot sur 3 au total -> score 0.5, bien
  // sous le seuil de 0.9 par défaut.
  const legacy = [ex('Sit-Up', 'Sit-Up', 'Abdominals', 'Body only')];
  const news = [ex('hgd_0001', 'Decline Sit-up', 'Abdominals', 'Body only')];
  assert.deepEqual(findSafeDuplicatePairs(legacy, news), []);
});

test('findSafeDuplicatePairs: appariement glouton — un exercice n\'est utilisé que dans une seule paire', () => {
  const legacy = [
    ex('Front_Raise', 'Front Dumbbell Raise', 'Shoulders', 'Dumbbell'),
    ex('Front_Raise_2', 'Dumbbell Raise Front', 'Shoulders', 'Dumbbell'), // matcherait aussi le même new
  ];
  const news = [ex('hgd_0001', 'Dumbbell Front Raise', 'Shoulders', 'Dumbbell')];
  const pairs = findSafeDuplicatePairs(legacy, news);
  assert.equal(pairs.length, 1); // un seul new dispo, une seule paire possible
  const usedNewIds = new Set(pairs.map(p => p.newId));
  assert.equal(usedNewIds.size, pairs.length);
});

test('findSafeDuplicatePairs: seuil personnalisé', () => {
  const legacy = [ex('A', 'Leg Curl', 'Hamstrings', 'Body only')];
  const news = [ex('hgd_0001', 'Standing Single Leg Curl', 'Hamstrings', 'Body only')];
  // score ~0.5 : rejeté au seuil par défaut (0.9), accepté avec un seuil abaissé exprès pour ce test
  assert.deepEqual(findSafeDuplicatePairs(legacy, news), []);
  const loose = findSafeDuplicatePairs(legacy, news, 0.4);
  assert.equal(loose.length, 1);
});
