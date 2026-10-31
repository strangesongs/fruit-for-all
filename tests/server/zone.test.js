import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import {
  parseZipZones, zoneFromTable, zoneAt, detectZone, setZipZonesForTests, ZIP_ZONES_FILE, MAX_KM,
} from '../../server/schemas/zone.js';
import { planRezone } from '../../server/db/rezone.js';

// A few real ZIP centres (2023 map) in the table's own format.
const FIXTURE = parseZipZones([
  '# test rows',
  'lat,lng,zone',
  '34.079,-118.266,10b', // 90026 Echo Park
  '34.098,-118.329,10b', // 90028 Hollywood
  '47.614,-122.320,9a',  // 98122 Seattle
  '25.775,-80.198,11a',  // 33130 Miami
  '41.881,-87.628,6b',   // 60603 Chicago
].join('\n'));

describe('the ZIP table lookup', () => {
  after(() => setZipZonesForTests(null));

  test('parses comment lines, the header and subzones', () => {
    assert.equal(FIXTURE.zone.length, 5);
    assert.equal(FIXTURE.zone[0], '10b');
  });

  test('nearest ZIP centre wins, as a whole-number zone', () => {
    const hit = zoneFromTable(34.077, -118.26, FIXTURE); // Echo Park lake
    assert.equal(hit.zone, 10);
    assert.equal(hit.subzone, '10b');
    assert.ok(hit.km < 1, String(hit.km));
    assert.equal(zoneFromTable(47.6, -122.33, FIXTURE).zone, 9);
    assert.equal(zoneFromTable(25.77, -80.19, FIXTURE).zone, 11);
  });

  test('finds a neighbour across a whole-degree line', () => {
    // 41.999 sits in the 41° cell; the point is in the 42° cell, ~13 km away
    const t = parseZipZones('lat,lng,zone\n41.999,-87.700,6a');
    assert.equal(zoneFromTable(42.1, -87.7, t).zone, 6);
  });

  test(`nothing within ${MAX_KM} km → null (the estimate takes over)`, () => {
    assert.equal(zoneFromTable(30, -140, FIXTURE), null); // mid-Pacific
    assert.equal(zoneFromTable(Number.NaN, -118, FIXTURE), null);
    setZipZonesForTests(FIXTURE);
    assert.equal(zoneAt(30, -140), 10); // detectZoneFallback for lat 30
  });

  test('zoneAt / detectZone use the table when it has the spot', async () => {
    setZipZonesForTests(FIXTURE);
    assert.equal(zoneAt(34.08, -118.27), 10);
    assert.equal(await detectZone(41.88, -87.63), 6);
  });
});

describe('planRezone', () => {
  const lookup = (lat, lng) => zoneFromTable(lat, lng, FIXTURE);
  const row = (pin_id, zone, lat, lng) => ({ pin_id, fruit_type: 'loquat', zone, lat, lng });

  test('lists only finds whose zone changes; leaves far-off finds alone', () => {
    const plan = planRezone([
      row('a', 9, 34.08, -118.27),   // LA saved as 9 → 10
      row('b', 10, 34.09, -118.32),  // already right
      row('c', null, 47.61, -122.32),// no zone → 9
      row('d', 8, 30, -140),         // nowhere near a ZIP
    ], lookup);
    assert.deepEqual(plan.changes.map((c) => [c.pinId, c.from, c.to, c.subzone]), [['a', 9, 10, '10b'], ['c', null, 9, '9a']]);
    assert.equal(plan.same, 1);
    assert.deepEqual(plan.unknown.map((u) => u.pinId), ['d']);
  });

  test('coordinates as strings (from pg) still work', () => {
    const plan = planRezone([row('a', 9, '34.08', '-118.27')], lookup);
    assert.equal(plan.changes[0].to, 10);
  });
});

// The real table (server/data/zip-zones.csv), when it's there.
describe('the real 2023 ZIP table', { skip: !existsSync(ZIP_ZONES_FILE) && 'server/data/zip-zones.csv not built yet' }, () => {
  after(() => setZipZonesForTests(null));
  const cases = [
    ['Echo Park, Los Angeles', 34.077, -118.26, 10],
    ['Silver Lake, Los Angeles', 34.09, -118.27, 10],
    ['San Francisco', 37.77, -122.42, 10],
    ['Seattle', 47.61, -122.33, 9],
    ['Phoenix', 33.45, -112.07, 10],
    ['Miami', 25.77, -80.19, 11],
    ['Chicago', 41.88, -87.63, 6],
    ['Minneapolis', 44.98, -93.27, 5],
    ['New York', 40.71, -74.0, 7],
  ];
  for (const [name, lat, lng, zone] of cases) {
    test(`${name} is zone ${zone}`, () => {
      setZipZonesForTests(null);
      const hit = zoneFromTable(lat, lng);
      assert.ok(hit, 'no ZIP centre found');
      assert.equal(hit.zone, zone, `${name}: ${hit.subzone}`);
    });
  }
});
