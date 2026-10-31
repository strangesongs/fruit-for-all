#!/usr/bin/env node
// Builds server/data/zip-zones.csv (what server/schemas/zone.js looks zones up in)
// from frostline's bulk file: https://phzmapi.org/all.csv
// (columns: zipcode, zone, temperature_range, latitude, longitude).
//
//   node scripts/build-zip-zones.mjs path/to/all.csv
//
// Keeps only what the lookup needs: each ZIP centre (3 decimals, ~100 m) and its
// zone ("10b"). Rows without coordinates or a zone are skipped. Re-run when
// PRISM publishes a new map; check the vintage line it prints.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const src = process.argv[2];
if (!src) {
  console.error('usage: node scripts/build-zip-zones.mjs path/to/all.csv');
  process.exit(2);
}

// Minimal CSV: frostline's fields never contain commas inside quotes except
// temperature_range ("35 to 40"), which has none, but strip quotes anyway.
const lines = readFileSync(src, 'utf8').split(/\r?\n/).filter(Boolean);
const header = lines.shift().split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
const col = (name) => {
  const i = header.indexOf(name);
  if (i < 0) throw new Error(`all.csv has no "${name}" column (header: ${header.join(', ')})`);
  return i;
};
const [iZone, iLat, iLng] = [col('zone'), col('latitude'), col('longitude')];

const rows = [];
let skipped = 0;
for (const line of lines) {
  const f = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
  const lat = Number(f[iLat]);
  const lng = Number(f[iLng]);
  const zone = f[iZone];
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !/^\d{1,2}[ab]?$/.test(zone || '')) {
    skipped += 1;
    continue;
  }
  rows.push(`${lat.toFixed(3)},${lng.toFixed(3)},${zone}`);
}
rows.sort();

const out = new URL('../server/data/zip-zones.csv', import.meta.url);
mkdirSync(new URL('.', out), { recursive: true });
writeFileSync(out, [
  '# USDA plant hardiness zone per ZIP code centre: 2023 USDA map (PRISM Climate Group, Oregon State University),',
  '# via frostline / phzmapi.org (https://github.com/waldoj/frostline, MIT). Built by scripts/build-zip-zones.mjs.',
  'lat,lng,zone',
  ...rows,
  '',
].join('\n'));
console.log(`wrote ${rows.length} ZIP centres to ${out.pathname} (skipped ${skipped})`);
