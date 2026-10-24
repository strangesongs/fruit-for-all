// PATCH /api/pins/:id body checks (edit a find: notes, kind and spot).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validatePinUpdate } from '../../server/schemas/validation.js';
import { FRUIT_LIST } from '../../client/utils/fruitList.js';

const FRUIT = new Set(FRUIT_LIST);

describe('validatePinUpdate', () => {
  test('accepts any one field, or all three', () => {
    assert.equal(validatePinUpdate({ notes: 'by the gate' }, FRUIT).valid, true);
    assert.equal(validatePinUpdate({ notes: '' }, FRUIT).valid, true);
    assert.equal(validatePinUpdate({ fruitType: 'Fig' }, FRUIT).valid, true);
    assert.equal(validatePinUpdate({ coordinates: { lat: 0, lng: 0 } }, FRUIT).valid, true);
    assert.equal(validatePinUpdate({ notes: 'x', fruitType: 'carob', coordinates: { lat: 34, lng: -118 } }, FRUIT).valid, true);
  });
  test('rejects an empty update', () => {
    assert.equal(validatePinUpdate({}, FRUIT).valid, false);
  });
  test('rejects (never throws on) wrong types', () => {
    const bad = [
      null, 'notes', [], { fruitType: 3 }, { fruitType: ['fig'] }, { fruitType: '  ' },
      { fruitType: 'plutonium' }, { coordinates: 'here' }, { coordinates: null },
      { coordinates: { lat: '34', lng: -118 } }, { coordinates: { lat: 91, lng: 0 } },
      { coordinates: { lat: NaN, lng: 0 } }, { notes: 42 }, { notes: { a: 1 } }, { notes: 'x'.repeat(1001) },
    ];
    for (const body of bad) {
      assert.doesNotThrow(() => validatePinUpdate(body, FRUIT));
      assert.equal(validatePinUpdate(body, FRUIT).valid, false, JSON.stringify(body));
    }
  });
});
