// The pin queries can't run here without DynamoDB, so these check the source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pinsSource = readFileSync(new URL('../../server/schemas/pins.js', import.meta.url), 'utf8');
const mapSource = readFileSync(new URL('../../client/map.jsx', import.meta.url), 'utf8');

test('both pin queries return newest first', () => {
  const matches = pinsSource.match(/ScanIndexForward: false/g) || [];
  assert.equal(matches.length, 2);
});

test('the map never asks for pins without a bounding box', () => {
  assert.doesNotMatch(mapSource, /this\.fetchPins\(\s*\)/);
  assert.doesNotMatch(mapSource, /this\.fetchPins\(\s*(true|false)\s*\)/);
});
